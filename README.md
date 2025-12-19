# RPC CacheFlow 💸

A high-performance, lightweight TypeScript proxy designed to slash RPC costs and improve dApp responsiveness by caching repetitive read requests in Redis.

## 🚀 Key Features
- **Intelligent Caching:** Automatic caching for `getAccountInfo`, `getBalance`, etc.
- **Batch Support:** Handles multi-request JSON-RPC arrays natively.
- **Unified Gateway:** Supports both **HTTP** and **WebSocket** (subscriptions) on a single port.
- **High Availability:** Built-in Load Balancer with active health checks.
- **Observability:** Prometheus metrics (`/metrics`) to track cache hit rates and savings.
- **Security:** Helmet headers, API Key authentication, and Redis-backed Rate Limiting.

## 🛠 Setup

### 1. Prerequisites
- Node.js 18+
- Redis Server
- Upstream RPC URL (e.g., Helius, Alchemy, QuickNode)

### 2. Environment Configuration
Create a `.env` file:
```env
PORT=3000
REDIS_URL=redis://localhost:6379
UPSTREAM_RPCS=https://your-rpc-url.com
CACHE_TTL=60
CACHEABLE_METHODS=getAccountInfo,getBalance,getHealth
RATE_LIMIT_MAX_REQUESTS=100
```

### 3. Running the Proxy
```bash
npm install
npm run build
npm start
```

## 🐳 Docker Deployment
```bash
docker-compose up -d --build
```

## 📊 Monitoring
Access metrics at `http://localhost:3000/metrics`.
Key metrics to watch:
- `rpc_proxy_cache_hits_total`: How many requests you've saved.
- `rpc_proxy_upstream_latency_seconds`: Speed of your upstream providers.

## ⚖️ License
MIT
