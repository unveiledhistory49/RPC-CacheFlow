import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import { createServer } from 'http';
import { config } from './config';
import { proxyHandler } from './proxy/handler';
import { authMiddleware } from './middleware/auth';
import { rateLimitMiddleware } from './middleware/rateLimit';
import { logger } from './utils/logger';
import { register } from './utils/metrics';
import { setupWebSocketProxy } from './proxy/ws';
import { redisService } from './cache/redis';
import { adminRouter } from './routes/admin';

export const app = express();
export const server = createServer(app);

// Security Headers (configured to allow WS upgrades)
app.use(helmet());
app.use(compression());
app.use(express.json());

// Health & Metrics
app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Admin API
app.use('/api/admin', adminRouter);

// Middleware & Proxy
app.use(authMiddleware);
app.use(rateLimitMiddleware);
app.post('/', proxyHandler);

// Initialize WebSocket Proxy
setupWebSocketProxy(server);

if (process.env.NODE_ENV !== 'test') {
  logger.info('Initializing RPC Cache Proxy Gateway...');

  server.listen(config.PORT, () => {
    logger.info(`🚀 Gateway Online  | Port: ${config.PORT}`);
    logger.info(`🎯 Load Balancer   | ${config.UPSTREAM_RPCS.length} nodes`);
    logger.info(`🧠 Cache Strategy  | ${config.CACHEABLE_METHODS.length} methods`);
  });
}

// Graceful Shutdown
const shutdown = async () => {
  logger.info('Shutting down gracefully...');
  server.close(async () => {
    await redisService.getClient().quit();
    logger.info('Closed all connections. Goodbye!');
    process.exit(0);
  });
  
  // Force close after 10s
  setTimeout(() => {
    logger.error('Could not close connections in time, forceful shutdown.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
