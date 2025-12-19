import request from 'supertest';
import { app, server } from '../../src/index';
import { redisService } from '../../src/cache/redis';
import { loadBalancer } from '../../src/proxy/balancer';
import axios from 'axios';

jest.mock('../../src/cache/redis', () => ({
  redisService: {
    get: jest.fn(),
    set: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    getClient: jest.fn().mockReturnValue({ quit: jest.fn() })
  }
}));

jest.mock('../../src/proxy/balancer', () => ({
  loadBalancer: {
    getNextRpc: jest.fn().mockReturnValue('http://mock-rpc.com'),
    stopHealthChecks: jest.fn()
  }
}));

jest.mock('axios');
jest.mock('../../src/utils/logger');

describe('Proxy Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (redisService.incr as jest.Mock).mockResolvedValue(1); // Pass rate limit
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    // If we mocked redisService.getClient().quit(), we don't need to do anything here
    // but ensuring everything is finished.
  });

  it('should return cached response if available', async () => {
    const mockCachedResponse = JSON.stringify({ jsonrpc: '2.0', result: 'cached-data', id: 1 });
    (redisService.get as jest.Mock).mockResolvedValue(mockCachedResponse);

    const response = await request(app)
      .post('/')
      .send({ jsonrpc: '2.0', id: 1, method: 'getAccountInfo', params: ['addr'] });

    expect(response.status).toBe(200);
    expect(response.body.result).toBe('cached-data');
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('should forward to upstream on cache miss and store in cache', async () => {
    (redisService.get as jest.Mock).mockResolvedValue(null);
    (axios.post as jest.Mock).mockResolvedValue({
      data: { jsonrpc: '2.0', result: 'upstream-data', id: 1 }
    });

    const response = await request(app)
      .post('/')
      .send({ jsonrpc: '2.0', id: 1, method: 'getAccountInfo', params: ['addr'] });

    expect(response.status).toBe(200);
    expect(response.body.result).toBe('upstream-data');
    expect(axios.post).toHaveBeenCalled();
    expect(redisService.set).toHaveBeenCalled();
  });

  it('should handle batch requests', async () => {
    (redisService.get as jest.Mock).mockResolvedValue(null);
    (axios.post as jest.Mock).mockResolvedValue({
      data: { jsonrpc: '2.0', result: 'data', id: 1 }
    });

    const response = await request(app)
      .post('/')
      .send([
        { jsonrpc: '2.0', id: 1, method: 'getAccountInfo', params: ['a'] },
        { jsonrpc: '2.0', id: 2, method: 'getAccountInfo', params: ['b'] }
      ]);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBe(2);
  });

  it('should return 502 if upstream fails', async () => {
    (redisService.get as jest.Mock).mockResolvedValue(null);
    (axios.post as jest.Mock).mockRejectedValue(new Error('Upstream Down'));

    const response = await request(app)
      .post('/')
      .send({ jsonrpc: '2.0', id: 1, method: 'getAccountInfo', params: ['addr'] });

    expect(response.status).toBe(502);
    expect(response.body.error.message).toContain('Upstream request failed');
  });
});
