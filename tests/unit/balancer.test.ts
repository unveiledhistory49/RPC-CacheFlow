import { LoadBalancer } from '../../src/proxy/balancer';
import axios from 'axios';
import { logger } from '../../src/utils/logger';

jest.mock('axios');
jest.mock('../../src/utils/logger');
jest.mock('../../src/config', () => ({
  config: {
    UPSTREAM_RPCS: ['http://rpc1.com', 'http://rpc2.com']
  }
}));

describe('LoadBalancer', () => {
  let balancer: LoadBalancer;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    balancer = new LoadBalancer();
  });

  afterEach(() => {
    balancer.stopHealthChecks();
    jest.useRealTimers();
  });

  it('should initialize with upstreams from config', () => {
    const rpc = balancer.getNextRpc();
    expect(['http://rpc1.com', 'http://rpc2.com']).toContain(rpc);
  });

  it('should return a healthy upstream', () => {
    // Assuming both are healthy initially
    const rpc1 = balancer.getNextRpc();
    const rpc2 = balancer.getNextRpc();

    expect(['http://rpc1.com', 'http://rpc2.com']).toContain(rpc1);
    expect(['http://rpc1.com', 'http://rpc2.com']).toContain(rpc2);
  });

  it('should continue to return nodes if health check fails only once', async () => {
    (axios.post as jest.Mock).mockRejectedValue(new Error('Fail'));

    // Trigger one health check manually
    // @ts-ignore
    await balancer.checkHealth();

    // Failures = 1. Should still be healthy.
    const rpc = balancer.getNextRpc();
    expect(rpc).toBeDefined();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('should handle all upstreams down', async () => {
     // Mock axios to always fail
     (axios.post as jest.Mock).mockRejectedValue(new Error('Down'));

     // We need 2 failures to mark as unhealthy
     
     // @ts-ignore
     await balancer.checkHealth(); // 1st failure
     // @ts-ignore
     await balancer.checkHealth(); // 2nd failure
     
     // Now consecutiveFailures should be >= 2
     
     // Verify logger warned
     expect(logger.warn).toHaveBeenCalled();

     // getNextRpc should still return something (hail mary) and log error
         const rpc = balancer.getNextRpc();
         expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('All upstreams are unhealthy'));
         expect(rpc).toBeDefined();
       });
     
       it('should prefer lower latency nodes using P2C', () => {
         // Manually set latencies (accessing private property for test)
         // @ts-ignore
         balancer.upstreams[0].averageLatency = 10; // Fast
         // @ts-ignore
         balancer.upstreams[1].averageLatency = 100; // Slow
     
         // Over many iterations, it should mostly pick the fast one (or at least handle the selection)
         // Since it's P2C with only 2 nodes, it will ALWAYS compare node 0 and 1 and pick 0.
         const results = [];
         for (let i = 0; i < 100; i++) {
           results.push(balancer.getNextRpc());
         }
     
         const count0 = results.filter(r => r === 'http://rpc1.com').length;
         const count1 = results.filter(r => r === 'http://rpc2.com').length;
     
         expect(count0).toBe(100);
         expect(count1).toBe(0);
       });
     
       it('should update average latency on recording response time', () => {
         balancer.recordResponseTime('http://rpc1.com', 50);
         // @ts-ignore
         expect(balancer.upstreams[0].averageLatency).toBe(50);
     
         balancer.recordResponseTime('http://rpc1.com', 100);
         // EMA: (100 * 0.1) + (50 * 0.9) = 10 + 45 = 55
         // @ts-ignore
         expect(balancer.upstreams[0].averageLatency).toBe(55);
       });
     });
