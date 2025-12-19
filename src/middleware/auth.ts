import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (!config.API_KEYS || config.API_KEYS.length === 0) {
    return next(); // Auth disabled if no keys configured
  }

  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey || !config.API_KEYS.includes(apiKey)) {
    return res.status(401).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Unauthorized: Invalid or missing API key',
      },
      id: req.body.id || null,
    });
  }

  next();
};
