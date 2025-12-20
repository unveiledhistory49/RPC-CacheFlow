import { Request, Response, NextFunction } from 'express';
import { redisService } from '../cache/redis';
import { config } from '../config';
import { logger } from '../utils/logger';

export const rateLimitMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  if (config.RATE_LIMIT_MAX_REQUESTS <= 0) {
    return next();
  }

  const identifier = (req.headers['x-api-key'] as string) || req.ip || 'unknown';
  const key = `ratelimit:${identifier}`;

  try {
    const currentCount = await redisService.incr(key);

    // Track global usage stats for the dashboard (Sorted Set)
    // Fire and forget to not slow down the request
    redisService.zincrby('rpc_usage_stats', 1, identifier).catch(err => {
      logger.error('Failed to update usage stats', err);
    });

    if (currentCount === 1) {
      await redisService.expire(key, config.RATE_LIMIT_WINDOW);
    }

    if (currentCount > config.RATE_LIMIT_MAX_REQUESTS) {
      logger.warn(`Rate limit exceeded for ${identifier}`);
      return res.status(429).json({
        jsonrpc: '2.0',
        error: {
          code: -32005,
          message: 'Rate limit exceeded',
        },
        id: req.body.id || null,
      });
    }

    next();
  } catch (error) {
    logger.error('Rate limit middleware error', error);
    next(); // Fail open if Redis is down for rate limiting, or fail closed depending on requirements. Choosing fail open for availability.
  }
};
