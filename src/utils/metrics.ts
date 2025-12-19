import client from 'prom-client';

// Create a Registry
export const register = new client.Registry();

// Add default metrics (CPU, Memory, Event Loop Lag, etc.)
client.collectDefaultMetrics({ register, prefix: 'rpc_proxy_' });

// Custom Metrics
export const rpcRequestsTotal = new client.Counter({
  name: 'rpc_proxy_requests_total',
  help: 'Total number of RPC requests received',
  labelNames: ['method', 'status'], // status: 'success', 'error'
  registers: [register],
});

export const cacheHitsTotal = new client.Counter({
  name: 'rpc_proxy_cache_hits_total',
  help: 'Total number of requests served from cache',
  labelNames: ['method'],
  registers: [register],
});

export const cacheMissesTotal = new client.Counter({
  name: 'rpc_proxy_cache_misses_total',
  help: 'Total number of requests forwarded to upstream',
  labelNames: ['method'],
  registers: [register],
});

export const upstreamLatency = new client.Histogram({
  name: 'rpc_proxy_upstream_latency_seconds',
  help: 'Latency of upstream RPC requests',
  labelNames: ['upstream', 'method'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

export const upstreamErrorsTotal = new client.Counter({
  name: 'rpc_proxy_upstream_errors_total',
  help: 'Total number of upstream errors',
  labelNames: ['upstream', 'error_type'],
  registers: [register],
});
