import { Server } from 'http';
import WebSocket from 'ws';
import { loadBalancer } from './balancer';
import { logger } from '../utils/logger';

export const setupWebSocketProxy = (server: Server) => {
  const wss = new WebSocket.Server({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const upstreamUrl = loadBalancer.getNextRpc();
    
    // Convert HTTP URL to WS URL
    const wsUpstreamUrl = upstreamUrl.replace('http', 'ws');

    logger.info(`WebSocket Upgrade request. Forwarding to ${wsUpstreamUrl}`);

    const targetWs = new WebSocket(wsUpstreamUrl);

    targetWs.on('open', () => {
      wss.handleUpgrade(request, socket, head, (clientWs) => {
        // Bi-directional pipe
        const clientStream = WebSocket.createWebSocketStream(clientWs);
        const targetStream = WebSocket.createWebSocketStream(targetWs);

        clientStream.pipe(targetStream).pipe(clientStream);

        clientWs.on('error', (err) => logger.error('Client WS Error', err));
        targetWs.on('error', (err) => logger.error('Target WS Error', err));
        
        clientWs.on('close', () => targetWs.close());
        targetWs.on('close', () => clientWs.close());
      });
    });

    targetWs.on('error', (err) => {
      logger.error(`Failed to connect to upstream WS: ${wsUpstreamUrl}`, err);
      socket.destroy();
    });
  });

  logger.info('WebSocket Proxy initialized (Passthrough mode)');
};
