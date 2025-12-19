import { Server } from 'http';
import WebSocket from 'ws';
import { loadBalancer } from './balancer';
import { logger } from '../utils/logger';
import { subscriptionManager } from './wsMultiplexer';

export const setupWebSocketProxy = (server: Server) => {
  const wss = new WebSocket.Server({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (clientWs) => {
      const upstreamUrl = loadBalancer.getNextRpc().replace('http', 'ws');
      const defaultUpstreamWs = new WebSocket(upstreamUrl);

      // Handle regular RPC calls over WS (passthrough)
      clientWs.on('message', (data) => {
        const message = data.toString();
        
        // Try to multiplex if it's a subscription
        try {
          const json = JSON.parse(message);
          if (json.method && json.method.includes('Subscribe')) {
            subscriptionManager.handleClientMessage(clientWs, message);
            return;
          }
        } catch (e) {}

        // Fallback: Passthrough to default upstream
        if (defaultUpstreamWs.readyState === WebSocket.OPEN) {
          defaultUpstreamWs.send(data);
        } else {
          defaultUpstreamWs.once('open', () => defaultUpstreamWs.send(data));
        }
      });

      defaultUpstreamWs.on('message', (data) => {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(data);
        }
      });

      clientWs.on('close', () => {
        defaultUpstreamWs.close();
        subscriptionManager.removeClient(clientWs);
      });

      defaultUpstreamWs.on('error', (err) => logger.error('Default Upstream WS Error', err));
      clientWs.on('error', (err) => logger.error('Client WS Error', err));
    });
  });

  logger.info('WebSocket Proxy initialized with Multiplexing Support');
};
