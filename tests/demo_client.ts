import axios from 'axios';
import WebSocket from 'ws';

async function runDemo() {
  console.log('\n--- 🚀 Starting CacheFlow Developer Demo ---\n');

  // 1. Demonstrate Request Coalescing
  console.log('STEP 1: Request Coalescing (Collapsing)');
  console.log('Sending 5 identical requests simultaneously...');
  
  const coalescingRequests = Array(5).fill(0).map((_, i) => 
    axios.post('http://localhost:3000', {
      jsonrpc: '2.0',
      id: i,
      method: 'getAccountInfo',
      params: ['demo_address_123']
    }).then(res => res.data.result)
  );

  const results = await Promise.all(coalescingRequests);
  console.log(`Results received: ${results.length}`);
  console.log('Check Proxy logs for "Coalescing request for key..."\n');

  // 2. Demonstrate Latency-Based Routing (P2C)
  console.log('STEP 2: Latency-Based Routing (P2C)');
  console.log('Sending 20 requests with unique params to warm up the balancer (forcing cache misses)...');
  
  for (let i = 0; i < 20; i++) {
    await axios.post('http://localhost:3000', {
      jsonrpc: '2.0',
      id: i,
      method: 'getBalance',
      params: ['warmup_addr_' + i]
    });
  }
  
  console.log('Balancer should now favor the fast node (rpc1) over the slow node (rpc2).');
  console.log('Observe the "slow_node_data" vs "fast_node_data" in the next 5 requests:');
  
  for (let i = 0; i < 5; i++) {
    const res = await axios.post('http://localhost:3000', {
      jsonrpc: '2.0',
      id: 100 + i,
      method: 'getBalance',
      params: ['test_addr_' + i] // Different params to bypass cache
    });
    const result = res.data.result;
    console.log(`Request ${i+1}: Node Response = ${result}${result === undefined ? ' (ERROR: ' + JSON.stringify(res.data) + ')' : ''}`);
  }
  console.log('');

  // 3. Demonstrate WebSocket Multiplexing
  console.log('STEP 3: WebSocket Subscription Multiplexing');
  
  const ws1 = new WebSocket('ws://localhost:3000');
  const ws2 = new WebSocket('ws://localhost:3000');

  const subscribe = (ws: WebSocket, label: string) => {
    return new Promise<void>((resolve) => {
      ws.on('open', () => {
        console.log(`[${label}] Connected to Proxy`);
        ws.send(JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'accountSubscribe',
          params: ['target_account']
        }));
      });

      ws.on('message', (data) => {
        const json = JSON.parse(data.toString());
        if (json.result === 888) {
          console.log(`[${label}] Subscription Confirmed (ID: 888)`);
          resolve();
        } else if (json.method === 'accountNotification') {
          console.log(`[${label}] Received Notification: ${json.params.result}`);
        }
      });
    });
  };

  console.log('Opening 2 Client WS connections...');
  await Promise.all([
    subscribe(ws1, 'CLIENT A'),
    subscribe(ws2, 'CLIENT B')
  ]);

  console.log('\nMultiplexing is active. Check Proxy logs for "Multiplexing existing subscription..."');
  console.log('Wait 5 seconds for notifications to flow to BOTH clients from ONE upstream connection...');
  
  setTimeout(() => {
    console.log('\nClosing connections. Demo Finished.');
    ws1.close();
    ws2.close();
    process.exit(0);
  }, 5000);
}

runDemo().catch(console.error);
