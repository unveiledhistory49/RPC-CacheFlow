import WebSocket from 'ws';
import { logger } from '../utils/logger';
import { loadBalancer } from './balancer';

interface Subscription {
  method: string;
  params: any[];
  upstreamWs: WebSocket;
  clients: Set<WebSocket>;
  subscriptionId?: number | string;
}

export class SubscriptionManager {
  private subscriptions = new Map<string, Subscription>();
  
  // Maps subscriptionId -> key
  private idToKey = new Map<number | string, string>();
  
  // Maps client WS to their active subscriptions to cleanup on close
  private clientSubs = new Map<WebSocket, Set<string>>();

  private getSubscriptionKey(method: string, params: any[]): string {
    return JSON.stringify({ method, params });
  }

  public handleClientMessage(clientWs: WebSocket, message: string) {
    try {
      const json = JSON.parse(message);
      if (json.method && json.method.includes('Subscribe')) {
        this.handleSubscribe(clientWs, json);
      } else if (json.method && json.method.includes('Unsubscribe')) {
        this.handleUnsubscribe(clientWs, json);
      }
    } catch (e) {
      // Ignore non-json
    }
  }

  private handleUnsubscribe(clientWs: WebSocket, request: any) {
    const subId = request.params?.[0];
    const key = this.idToKey.get(subId);
    if (key) {
      const sub = this.subscriptions.get(key);
      if (sub) {
        sub.clients.delete(clientWs);
        this.clientSubs.get(clientWs)?.delete(key);
        
        // Respond success to client
        clientWs.send(JSON.stringify({
          jsonrpc: '2.0',
          result: true,
          id: request.id
        }));

        if (sub.clients.size === 0) {
          logger.info(`Closing upstream subscription: ${key}`);
          sub.upstreamWs.close();
          this.subscriptions.delete(key);
          this.idToKey.delete(subId);
        }
      }
    }
  }

  private handleSubscribe(clientWs: WebSocket, request: any) {
    const key = this.getSubscriptionKey(request.method, request.params);
    let sub = this.subscriptions.get(key);

    if (sub && sub.subscriptionId !== undefined) {
      logger.info(`Multiplexing existing subscription: ${key}`);
      sub.clients.add(clientWs);
      this.trackClientSub(clientWs, key);
      
      clientWs.send(JSON.stringify({
        jsonrpc: '2.0',
        result: sub.subscriptionId,
        id: request.id
      }));
    } else {
      this.createNewUpstreamSubscription(clientWs, request, key);
    }
  }

  private createNewUpstreamSubscription(clientWs: WebSocket, request: any, key: string) {
     const upstreamUrl = loadBalancer.getNextRpc().replace('http', 'ws');
     const upstreamWs = new WebSocket(upstreamUrl);

     upstreamWs.on('open', () => {
       upstreamWs.send(JSON.stringify(request));
     });

     upstreamWs.on('message', (data) => {
       const msg = data.toString();
       const json = JSON.parse(msg);

       // If it's the result of the initial subscribe call
       if (json.id === request.id) {
         const subId = json.result;
         const sub = this.subscriptions.get(key);
         if (sub) {
           sub.subscriptionId = subId;
           this.idToKey.set(subId, key);
           // Send to the initiating client
           clientWs.send(msg);
         }
       } else if (json.method && json.method.includes('Notification')) {
         // It's a notification!
         // In Solana, the subId is usually in params.subscription
         const subId = json.params?.subscription;
         const subKey = this.idToKey.get(subId);
         const sub = subKey ? this.subscriptions.get(subKey) : null;
         
         if (sub) {
           sub.clients.forEach(c => {
             if (c.readyState === WebSocket.OPEN) {
               c.send(msg);
             }
           });
         }
       }
     });

     const sub: Subscription = {
       method: request.method,
       params: request.params,
       upstreamWs,
       clients: new Set([clientWs])
     };
     this.subscriptions.set(key, sub);
     this.trackClientSub(clientWs, key);
  }

  private trackClientSub(clientWs: WebSocket, key: string) {
    if (!this.clientSubs.has(clientWs)) {
      this.clientSubs.set(clientWs, new Set());
    }
    this.clientSubs.get(clientWs)?.add(key);
  }

  public removeClient(clientWs: WebSocket) {
    const subs = this.clientSubs.get(clientWs);
    if (subs) {
      subs.forEach(key => {
        const sub = this.subscriptions.get(key);
        if (sub) {
          sub.clients.delete(clientWs);
          if (sub.clients.size === 0) {
            logger.info(`Closing upstream subscription as no clients left: ${key}`);
            sub.upstreamWs.close();
            this.subscriptions.delete(key);
          }
        }
      });
      this.clientSubs.delete(clientWs);
    }
  }
}

export const subscriptionManager = new SubscriptionManager();
