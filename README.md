# RPC CacheFlow 💸

[![CI](https://github.com/user/rpc-cacheflow/actions/workflows/ci.yml/badge.svg)](https://github.com/user/rpc-cacheflow/actions/workflows/ci.yml)
[![Docker](https://github.com/user/rpc-cacheflow/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/user/rpc-cacheflow/actions/workflows/docker-publish.yml)

A high-performance, enterprise-grade RPC proxy and gateway designed to slash blockchain RPC costs, improve dApp responsiveness, and provide deep observability.

## 🚀 Key Features

### ⚡ Performance & Cost
*   **Intelligent Caching:** Automatic, configurable caching for heavy read methods (`getAccountInfo`, `getBalance`, etc.).
*   **Request Coalescing:** Merges simultaneous identical requests (cache stampede prevention).
*   **WebSocket Multiplexing:** Shares a *single* upstream subscription across thousands of clients, drastically reducing Compute Unit (CU) usage.
*   **Smart Load Balancing:** Uses "Power of Two Choices" (P2C) with real-time latency tracking to always route to the fastest healthy node.

### 🛡️ Reliability & Security
*   **Active Health Checks:** Automatically detects and isolates unhealthy upstream nodes.
*   **Rate Limiting:** Redis-backed sliding window limits per IP or API Key.
*   **Security:** Helmet headers, API Key authentication, and Admin Secret protection.

### 📊 Observability & DevOps
*   **Admin Dashboard:** A Next.js UI for real-time traffic monitoring, upstream health status, and "Top Consumers" leaderboards.
*   **Prometheus Metrics:** Native `/metrics` endpoint for Grafana integration.
*   **Kubernetes Ready:** Includes an official Helm Chart with HPA (Horizontal Pod Autoscaling).

---

## 🛠 Quick Start

### 1. Prerequisites
*   Node.js 18+
*   Redis Server (v6+)

### 2. Installation
```bash
git clone https://github.com/your/rpc-cacheflow.git
cd rpc-cacheflow
npm install
```

### 3. Configuration
Create a `.env` file (see `.env.example`):
```env
PORT=3000
REDIS_URL=redis://localhost:6379
UPSTREAM_RPCS=https://rpc-1.com,https://rpc-2.com
ADMIN_SECRET=super_secret_password
```

### 4. Run Locally
```bash
# Start the Proxy
npm run build && npm start

# Start the Dashboard (in a separate terminal)
cd dashboard
npm install
npm run dev
```

---

## 🐳 Deployment

### Docker Compose
Deploy the Proxy, Redis, and (optionally) the Dashboard together.
```bash
docker-compose up -d --build
```

### Kubernetes (Helm) ☸️
Deploy to your cluster using the included Helm chart.

```bash
# Install with default values
helm install my-cacheflow ./charts/rpc-cacheflow

# Install with custom values
helm install my-cacheflow ./charts/rpc-cacheflow \
  --set config.upstreamRpcs="https://api.mainnet-beta.solana.com" \
  --set autoscaling.enabled=true
```

---

## 🖥️ Admin Dashboard
Access the dashboard at `http://localhost:3000` (via Next.js) to view:
*   **Upstream Health:** Real-time latency and status (Healthy/Down).
*   **Top Consumers:** Leaderboard of most active API keys.
*   **System Stats:** Memory usage, uptime, and cache hit rates.

---

## 📈 Monitoring
Raw metrics are available at `http://localhost:3000/metrics` for scraping by Prometheus.
*   `rpc_proxy_cache_hits_total`
*   `rpc_proxy_upstream_latency_seconds`
*   `rpc_proxy_active_subscriptions`

---

## ⚖️ License
MIT