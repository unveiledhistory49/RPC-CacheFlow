import axios from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';

interface Upstream {
  url: string;
  isHealthy: boolean;
  consecutiveFailures: number;
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
      // If all are down, round robin through all of them anyway
      const rpc = this.upstreams[this.currentIndex];
      this.currentIndex = (this.currentIndex + 1) % this.upstreams.length;
      return rpc.url;
    }

    // Simple round robin among HEALTHY nodes
    // Note: this implementation resets the index if the healthy list changes size significantly, 
    // but for simple cases, we can just find the next healthy one relative to global index.
    
    // Better Round Robin:
    const selected = healthyUpstreams[this.currentIndex % healthyUpstreams.length];
    this.currentIndex = (this.currentIndex + 1) % healthyUpstreams.length;
    
    return selected.url;
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