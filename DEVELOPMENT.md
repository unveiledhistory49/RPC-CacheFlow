# Development Guide: Self-Hosted RPC Caching Proxy

This document outlines the step-by-step development process for building a production-ready, lightweight RPC caching proxy using Node.js, TypeScript, and Redis.

## **Project Overview**

The goal is to build a high-performance proxy server that intercepts JSON-RPC requests (specifically for Solana/Ethereum compatible chains), caches repetitive read operations in Redis, and reduces load on expensive upstream RPC providers.

**Key Features:**
*   **Intelligent Caching:** Caches `getAccountInfo`, `getBalance`, and other heavy read methods.
*   **Load Balancing:** Distributes cache misses across multiple upstream RPC endpoints.
*   **Rate Limiting & Auth:** Protects the proxy with optional API keys and request quotas.
*   **Dockerized:** Ready for easy deployment via Docker Compose.

---

## **Phase 1: Project Initialization & Setup**

### 1.1 Initialize Project
Set up the Node.js environment with TypeScript support.

```bash
mkdir rpc-cache-proxy
cd rpc-cache-proxy
npm init -y
```

### 1.2 Install Dependencies
*   **Runtime:** `express`, `ioredis`, `axios`, `dotenv`, `zod` (for validation), `http-proxy-middleware`.
*   **Dev:** `typescript`, `@types/node`, `@types/express`, `ts-node`, `nodemon`, `eslint`, `prettier`.

```bash
npm install express ioredis axios dotenv zod
npm install -D typescript @types/node @types/express ts-node nodemon eslint prettier
```

### 1.3 TypeScript Configuration
Create `tsconfig.json` for strict type checking and modern Node.js support.

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "rootDir": "./src",
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

### 1.4 Directory Structure
```
rpc-cache-proxy/
├── src/
│   ├── config/         # Environment & Zod schemas
│   ├── cache/          # Redis logic
│   ├── proxy/          # Request handling & Load balancing
│   ├── middleware/     # Auth & Rate limiting
│   ├── utils/          # Hashing, Logging
│   └── index.ts        # Entry point
├── Dockerfile
├── docker-compose.yml
└── package.json
```

---

## **Phase 2: Core Architecture & Configuration**

### 2.1 Configuration Module (`src/config/index.ts`)
Use `zod` to validate environment variables.
*   `PORT`: Server port (default 3000).
*   `REDIS_URL`: Connection string for Redis.
*   `UPSTREAM_RPCS`: Comma-separated list of RPC URLs.
*   `CACHE_TTL`: Default time-to-live for cache keys (in seconds).
*   `API_KEYS`: Optional list of valid keys for auth.

### 2.2 Logger
Implement a structured logger (e.g., using `pino` or simple `console` wrapper) to track cache hits/misses and errors.

---

## **Phase 3: Caching Layer Implementation**

### 3.1 Redis Client (`src/cache/redis.ts`)
Initialize `ioredis` connection. Handle connection errors gracefully.

### 3.2 Cache Logic
Create a class/service `CacheService`:
*   **Key Generation:** Hash the JSON-RPC method + params (deterministic stringify + SHA256).
*   **`get(key)`:** Retrieve cached response.
*   **`set(key, value, ttl)`:** Store response with expiration.
*   **Whitelist:** Define which RPC methods are safe to cache (e.g., `getAccountInfo`, `getBlock`). *Never* cache `sendTransaction`.

---

## **Phase 4: Proxy Logic & Load Balancing**

### 4.1 Load Balancer (`src/proxy/balancer.ts`)
Implement a simple Round-Robin or Random strategy to rotate through the `UPSTREAM_RPCS` array for every cache miss.

### 4.2 Request Handler (`src/proxy/handler.ts`)
The core Express controller:
1.  **Parse Body:** Ensure valid JSON-RPC 2.0 format.
2.  **Auth Check:** (If enabled) Validate headers.
3.  **Cache Check:**
    *   If method is cacheable, generate key -> Check Redis.
    *   **HIT:** Return cached JSON immediately.
4.  **Forwarding (Miss):**
    *   Select upstream RPC via Load Balancer.
    *   Send request via `axios`.
5.  **Cache Write:**
    *   If upstream response is valid (no RPC error), write to Redis.
6.  **Response:** Send data back to client.

---

## **Phase 5: Authentication & Rate Limiting**

### 5.1 Auth Middleware
Check for `x-api-key` header against the configured list. Return `401 Unauthorized` if invalid.

### 5.2 Rate Limiting
Use Redis to implement a sliding window or fixed window counter.
*   Key: `ratelimit:<ip_or_api_key>`
*   If count > limit, return `429 Too Many Requests`.

---

## **Phase 6: Testing & Validation**

*   **Unit Tests:** Test Key Generation and Config validation.
*   **Integration Tests:**
    *   Mock Redis and Upstream RPC.
    *   Verify Cache Hit vs. Miss behavior.
    *   Verify Round-Robin rotation.
*   **Load Testing:** Use `autocannon` or `k6` to benchmark throughput.

---

## **Phase 7: Containerization**

### 7.1 Dockerfile
Multi-stage build:
1.  **Build Stage:** Install dependencies, compile TS -> JS.
2.  **Production Stage:** Copy `dist`, install only production deps (alpine node image).

### 7.2 Docker Compose
Orchestrate the app + Redis instance.
```yaml
services:
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
  
  proxy:
    build: .
    environment:
      - REDIS_URL=redis://redis:6379
      - UPSTREAM_RPCS=https://api.mainnet-beta.solana.com
    ports:
      - "3000:3000"
    depends_on:
      - redis
```

---

## **Phase 8: Deployment Guide**

1.  **Clone & Configure:**
    ```bash
    git clone <repo>
    cp .env.example .env
    ```
2.  **Run with Docker:**
    ```bash
    docker-compose up -d --build
    ```
3.  **Verify:**
    ```bash
    curl -X POST -H "Content-Type: application/json" \
         -d '{"jsonrpc":"2.0","id":1, "method":"getHealth"}' \
         http://localhost:3000
    ```

---

## **Conclusion**
Upon completion, this project will serve as a robust, cost-saving infrastructure piece for any developer building on EVM or Solana chains, reducing reliance on paid tiers and improving dApp responsiveness.
