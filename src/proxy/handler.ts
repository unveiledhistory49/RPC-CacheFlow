import { Request, Response } from 'express';
import axios from 'axios';
import { config } from '../config';
import { redisService } from '../cache/redis';
import { loadBalancer } from './balancer';
import { requestCoalescer } from './coalescer';
import { generateCacheKey } from '../utils/hash';
import { logger } from '../utils/logger';
import { 
  rpcRequestsTotal, 
  cacheHitsTotal, 
  cacheMissesTotal, 
  upstreamLatency, 
  upstreamErrorsTotal 
} from '../utils/metrics';

/**
 * Processes a single JSON-RPC request, checking cache and forwarding to upstream if needed.
 */
const processSingleRequest = async (rpcReq: any, upstreamUrl: string) => {
  const { method, params } = rpcReq;

  // Track metrics
  rpcRequestsTotal.labels(method || 'unknown', 'pending').inc();

  const isCacheable = method && config.CACHEABLE_METHODS.includes(method);
  const cacheKey = isCacheable ? generateCacheKey(method, params) : null;

  // 1. Check Cache
  if (isCacheable && cacheKey) {
    try {
      const cachedResponse = await redisService.get(cacheKey);
      if (cachedResponse) {
        cacheHitsTotal.labels(method).inc();
        rpcRequestsTotal.labels(method, 'success').inc();
        const parsed = JSON.parse(cachedResponse);
        // Ensure ID matches the current request
        return { ...parsed, id: rpcReq.id };
      }
    } catch (error) {
      logger.error('Redis read error', error);
    }
  }

  // 2. Cache Miss - Forward to Upstream
  const forwardToUpstream = async () => {
    cacheMissesTotal.labels(method || 'unknown').inc();
    const endTimer = upstreamLatency.labels(upstreamUrl, method || 'unknown').startTimer();

    try {
      const response = await axios.post(upstreamUrl, rpcReq, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      });
      const duration = endTimer();
      
      // Record real latency in load balancer
      if (typeof duration === 'number') {
        loadBalancer.recordResponseTime(upstreamUrl, duration * 1000); // endTimer returns seconds
      }

      const data = response.data;

      // 3. Store in Cache if valid
      if (isCacheable && cacheKey && data && !data.error && (data.result !== undefined)) {
        try {
          await redisService.set(cacheKey, JSON.stringify(data), config.CACHE_TTL);
        } catch (error) {
          logger.error('Redis write error', error);
        }
      }

      rpcRequestsTotal.labels(method || 'unknown', 'success').inc();
      return data;
    } catch (error: any) {
      endTimer();
      upstreamErrorsTotal.labels(upstreamUrl, error.code || 'unknown').inc();
      rpcRequestsTotal.labels(method || 'unknown', 'error').inc();
      throw error;
    }
  };

  if (isCacheable && cacheKey) {
    return requestCoalescer.execute(cacheKey, forwardToUpstream);
  }

  return forwardToUpstream();
};

export const proxyHandler = async (req: Request, res: Response) => {
  const body = req.body;
  const upstreamUrl = loadBalancer.getNextRpc();

  // Handle Batch Requests
  if (Array.isArray(body)) {
    logger.info(`Processing BATCH request of size ${body.length}`);
    try {
      const results = await Promise.all(
        body.map((singleReq) => 
          processSingleRequest(singleReq, upstreamUrl).catch((err) => ({
            jsonrpc: '2.0',
            id: singleReq.id || null,
            error: { code: -32603, message: err.message }
          }))
        )
      );
      return res.json(results);
    } catch (error: any) {
      return res.status(502).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Batch processing failed', data: error.message },
        id: null
      });
    }
  }

  // Handle Single Request
  try {
    const result = await processSingleRequest(body, upstreamUrl);
    return res.json(result);
  } catch (error: any) {
    logger.error(`Proxy Error: ${error.message}`);
    return res.status(error.response?.status || 502).json({
      jsonrpc: '2.0',
      id: body.id || null,
      error: { code: -32603, message: 'Upstream request failed', data: error.message }
    });
  }
};