import WebSocket from 'ws';
import { SubscriptionManager } from '../../src/proxy/wsMultiplexer';
import { loadBalancer } from '../../src/proxy/balancer';

jest.mock('ws', () => {
  const ws = jest.fn();
  (ws as any).OPEN = 1;
  (ws as any).CLOSED = 3;
  return ws;
});
jest.mock('../../src/proxy/balancer');
jest.mock('../../src/utils/logger');

describe('SubscriptionManager', () => {
  let manager: SubscriptionManager;
  let mockClientWs: any;
  let mockUpstreamWs: any;

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new SubscriptionManager();
    mockClientWs = {
      send: jest.fn(),
      readyState: 1, // WebSocket.OPEN
      on: jest.fn()
    };
    
    const createMockWs = () => ({
      send: jest.fn(),
      readyState: 1, // WebSocket.OPEN
      on: jest.fn(),
      close: jest.fn()
    });
    
    mockUpstreamWs = createMockWs();
    (WebSocket as unknown as jest.Mock).mockImplementation(() => mockUpstreamWs);
    (loadBalancer.getNextRpc as jest.Mock).mockReturnValue('http://rpc.com');
  });

  it('should create a new upstream subscription on first client request', () => {
    const msg = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'accountSubscribe',
      params: ['addr1']
    });

    manager.handleClientMessage(mockClientWs, msg);

    expect(WebSocket).toHaveBeenCalledWith('ws://rpc.com');
    
    // Simulate upstream open and response
    const onOpen = mockUpstreamWs.on.mock.calls.find((c: any) => c[0] === 'open')[1];
    onOpen();
    expect(mockUpstreamWs.send).toHaveBeenCalledWith(msg);

    const onMessage = mockUpstreamWs.on.mock.calls.find((c: any) => c[0] === 'message')[1];
    onMessage(JSON.stringify({ jsonrpc: '2.0', result: 123, id: 1 }));

    expect(mockClientWs.send).toHaveBeenCalledWith(expect.stringContaining('"result":123'));
  });

  it('should multiplex existing subscription for second client', () => {
    const msg1 = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'accountSubscribe', params: ['p'] });
    manager.handleClientMessage(mockClientWs, msg1);
    
    // Set up subId
    const onMessage = mockUpstreamWs.on.mock.calls.find((c: any) => c[0] === 'message')[1];
    onMessage(JSON.stringify({ jsonrpc: '2.0', result: 123, id: 1 }));

    const mockClientWs2 = { send: jest.fn(), readyState: 1 };
    const msg2 = JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'accountSubscribe', params: ['p'] });
    manager.handleClientMessage(mockClientWs2 as any, msg2);

    expect(WebSocket).toHaveBeenCalledTimes(1); // Still only one upstream
    expect(mockClientWs2.send).toHaveBeenCalledWith(expect.stringContaining('"result":123'));
    expect(mockClientWs2.send).toHaveBeenCalledWith(expect.stringContaining('"id":2'));
  });

  it('should broadcast notifications to all clients', () => {
    const msg1 = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'accountSubscribe', params: ['p'] });
    manager.handleClientMessage(mockClientWs, msg1);
    const onMessage = mockUpstreamWs.on.mock.calls.find((c: any) => c[0] === 'message')[1];
    onMessage(JSON.stringify({ jsonrpc: '2.0', result: 123, id: 1 }));

    const mockClientWs2 = { send: jest.fn(), readyState: 1 };
    manager.handleClientMessage(mockClientWs2 as any, JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'accountSubscribe', params: ['p'] }));

    const notification = JSON.stringify({
      jsonrpc: '2.0',
      method: 'accountNotification',
      params: { subscription: 123, result: 'update' }
    });
    onMessage(notification);

    expect(mockClientWs.send).toHaveBeenCalledWith(notification);
    expect(mockClientWs2.send).toHaveBeenCalledWith(notification);
  });
});
