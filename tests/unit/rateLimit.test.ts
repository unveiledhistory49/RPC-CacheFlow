import { rateLimitMiddleware } from '../../src/middleware/rateLimit';
import { redisService } from '../../src/cache/redis';
import { config } from '../../src/config';
import { Request, Response } from 'express';

jest.mock('../../src/cache/redis', () => ({
  redisService: {
    incr: jest.fn(),
    expire: jest.fn()
  }
}));

jest.mock('../../src/config', () => ({
  config: {
    RATE_LIMIT_MAX_REQUESTS: 100,
    RATE_LIMIT_WINDOW: 60
  }
}));

jest.mock('../../src/utils/logger');

describe('Rate Limit Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest = {
      headers: {},
      ip: '127.0.0.1',
      body: {}
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    nextFunction = jest.fn();
  });

  it('should pass if rate limiting is disabled', async () => {
    (config.RATE_LIMIT_MAX_REQUESTS as number) = 0;
    await rateLimitMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);
    expect(nextFunction).toHaveBeenCalled();
  });

  it('should increment counter and set expiry on first request', async () => {
    (config.RATE_LIMIT_MAX_REQUESTS as number) = 10;
    (redisService.incr as jest.Mock).mockResolvedValue(1);
    
    await rateLimitMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);
    
    expect(redisService.incr).toHaveBeenCalledWith('ratelimit:127.0.0.1');
    expect(redisService.expire).toHaveBeenCalledWith('ratelimit:127.0.0.1', 60);
    expect(nextFunction).toHaveBeenCalled();
  });

  it('should return 429 if rate limit is exceeded', async () => {
    (config.RATE_LIMIT_MAX_REQUESTS as number) = 10;
    (redisService.incr as jest.Mock).mockResolvedValue(11);
    
    await rateLimitMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);
    
    expect(mockResponse.status).toHaveBeenCalledWith(429);
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should use API key as identifier if present', async () => {
    (config.RATE_LIMIT_MAX_REQUESTS as number) = 10;
    mockRequest.headers = { 'x-api-key': 'user123' };
    (redisService.incr as jest.Mock).mockResolvedValue(1);
    
    await rateLimitMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);
    
    expect(redisService.incr).toHaveBeenCalledWith('ratelimit:user123');
    expect(nextFunction).toHaveBeenCalled();
  });

  it('should fail open if Redis fails', async () => {
    (config.RATE_LIMIT_MAX_REQUESTS as number) = 10;
    (redisService.incr as jest.Mock).mockRejectedValue(new Error('Redis Down'));
    
    await rateLimitMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);
    
    expect(nextFunction).toHaveBeenCalled();
  });
});
