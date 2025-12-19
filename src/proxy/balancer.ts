import axios from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';

interface Upstream {
  url: string;
  isHealthy: boolean;
  consecutiveFailures: number;
  latency: number;
  averageLatency: number;
}

export class LoadBalancer {
  private upstreams: Upstream[];
  private currentIndex: number = 0;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.upstreams = config.UPSTREAM_RPCS.map((url) => ({
      url,
      isHealthy: true, // Assume healthy initially
      consecutiveFailures: 0,
      latency: 0,
      averageLatency: 0,
    }));
    
    // Start background health checks
    if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
      this.startHealthChecks();
    }
  }

  public getNextRpc(): string {
    const healthyUpstreams = this.upstreams.filter((u) => u.isHealthy);

    if (healthyUpstreams.length === 0) {
      logger.error('CRITICAL: All upstreams are unhealthy! returning random one as hail mary.');
      const rpc = this.upstreams[this.currentIndex];
      this.currentIndex = (this.currentIndex + 1) % this.upstreams.length;
      return rpc.url;
    }

    if (healthyUpstreams.length === 1) {
      return healthyUpstreams[0].url;
    }

    // Power of Two Choices (P2C) strategy
    // Pick two random distinct indices
    const idx1 = Math.floor(Math.random() * healthyUpstreams.length);
    let idx2 = Math.floor(Math.random() * healthyUpstreams.length);
    while (idx2 === idx1) {
      idx2 = Math.floor(Math.random() * healthyUpstreams.length);
    }

    const node1 = healthyUpstreams[idx1];
    const node2 = healthyUpstreams[idx2];

    // Return the one with lower average latency
    // If averageLatency is 0 (not yet measured), it ranks better (exploration)
    const selected = node1.averageLatency <= node2.averageLatency ? node1 : node2;
    
    return selected.url;
  }

  public recordResponseTime(url: string, latency: number) {
    const upstream = this.upstreams.find((u) => u.url === url);
    if (upstream) {
      upstream.latency = latency;
      if (upstream.averageLatency === 0) {
        upstream.averageLatency = latency;
      } else {
        // Use a smaller alpha for real traffic to avoid jitter (0.1)
        upstream.averageLatency = (latency * 0.1) + (upstream.averageLatency * 0.9);
      }
    }
  }

  public stopHealthChecks() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  private startHealthChecks() {
    // Check every 30 seconds
    this.checkInterval = setInterval(() => this.checkHealth(), 30000);
    // Also run one immediately
    this.checkHealth();
  }

  private async checkHealth() {
    logger.info('Running upstream health checks...');
    
    for (const upstream of this.upstreams) {
      try {
        // Lightweight check: getHealth or getBlockHeight
        const start = Date.now();
        await axios.post(upstream.url, {
          jsonrpc: '2.0',
          id: 1,
          method: 'getHealth',
        }, { timeout: 5000 });
        
        const latency = Date.now() - start;
        upstream.latency = latency;
        
        // Exponential Moving Average (EMA) - alpha = 0.3
        if (upstream.averageLatency === 0) {
          upstream.averageLatency = latency;
        } else {
          upstream.averageLatency = (latency * 0.3) + (upstream.averageLatency * 0.7);
        }
        
        if (!upstream.isHealthy) {
          logger.info(`Upstream RECOVERED: ${upstream.url}`);
        }
        
        upstream.isHealthy = true;
        upstream.consecutiveFailures = 0;
      } catch (error: any) {
        upstream.consecutiveFailures++;
        if (upstream.isHealthy && upstream.consecutiveFailures >= 2) {
             upstream.isHealthy = false;
             logger.warn(`Upstream DOWN: ${upstream.url} - ${error.message}`);
        }
      }
    }
  }
}

export const loadBalancer = new LoadBalancer();

if (process.env.NODE_ENV === 'test') {
  // In tests, we might want to stop the automatic health checks of the singleton
  // to prevent leaking timers, as tests often create their own instances.
  loadBalancer.stopHealthChecks();
}