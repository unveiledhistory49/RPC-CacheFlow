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

  it('should round robin between healthy upstreams', () => {
    // Assuming both are healthy initially
    const rpc1 = balancer.getNextRpc();
    const rpc2 = balancer.getNextRpc();
    const rpc3 = balancer.getNextRpc();

    expect(rpc1).toBe('http://rpc1.com');
    expect(rpc2).toBe('http://rpc2.com');
    expect(rpc3).toBe('http://rpc1.com'); // Wraps around
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
});
