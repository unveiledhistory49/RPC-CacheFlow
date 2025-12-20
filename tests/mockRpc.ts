import express from 'express';
import { createServer } from 'http';
import WebSocket from 'ws';

const app = express();
app.use(express.json());

// Mock RPC Node 1 (Fast)
app.post('/rpc1', (req, res) => {
  if (req.body.method === 'getHealth') {
    return res.json({ jsonrpc: '2.0', result: 'ok', id: req.body.id });
  }
  setTimeout(() => {
    res.json({ jsonrpc: '2.0', result: 'fast_node_data', id: req.body.id });
  }, 5);
});

// Mock RPC Node 2 (Slow)
app.post('/rpc2', (req, res) => {
  if (req.body.method === 'getHealth') {
    return res.json({ jsonrpc: '2.0', result: 'ok', id: req.body.id });
  }
  setTimeout(() => {
    res.json({ jsonrpc: '2.0', result: 'slow_node_data', id: req.body.id });
  }, 150);
});

const server = createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    const json = JSON.parse(data.toString());
    if (json.method?.includes('Subscribe')) {
      ws.send(JSON.stringify({ jsonrpc: '2.0', result: 888, id: json.id }));
      
      // Send a few notifications
      setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            jsonrpc: '2.0',
            method: 'accountNotification',
            params: { subscription: 888, result: 'mock_update_' + Date.now() }
          }));
        }
      }, 2000);
    }
  });
});

server.listen(4000, () => {
  console.log('Mock RPC Nodes running on http://localhost:4000/rpc1 and /rpc2');
});
