import { authMiddleware } from '../../src/middleware/auth';
import { config } from '../../src/config';
import { Request, Response } from 'express';

jest.mock('../../src/config', () => ({
  config: {
    API_KEYS: []
  }
}));

describe('Auth Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: jest.Mock;

  beforeEach(() => {
    mockRequest = {
      headers: {},
      body: {}
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    nextFunction = jest.fn();
    (config.API_KEYS as string[]) = [];
  });

  it('should pass if no API keys are configured', () => {
    authMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);
    expect(nextFunction).toHaveBeenCalled();
  });

  it('should return 401 if API keys are configured but missing in request', () => {
    (config.API_KEYS as string[]) = ['key1'];
    authMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should return 401 if invalid API key is provided', () => {
    (config.API_KEYS as string[]) = ['key1'];
    mockRequest.headers = { 'x-api-key': 'wrong-key' };
    authMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should pass if valid API key is provided', () => {
    (config.API_KEYS as string[]) = ['key1', 'key2'];
    mockRequest.headers = { 'x-api-key': 'key2' };
    authMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);
    expect(nextFunction).toHaveBeenCalled();
  });
});
