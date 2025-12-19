import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const configSchema = z.object({
  PORT: z.string().default('3000').transform((val) => parseInt(val, 10)),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  UPSTREAM_RPCS: z.string().refine((val) => val.length > 0, "At least one upstream RPC URL is required").transform((val) => val.split(',').map((url) => url.trim())),
  CACHE_TTL: z.string().default('60').transform((val) => parseInt(val, 10)), // Default 60 seconds
  API_KEYS: z.string().optional().transform((val) => val ? val.split(',').map((key) => key.trim()) : []),
  RATE_LIMIT_WINDOW: z.string().default('60').transform((val) => parseInt(val, 10)), // Window in seconds
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100').transform((val) => parseInt(val, 10)), // Max requests per window
  CACHEABLE_METHODS: z.string().default('getAccountInfo,getBalance,getTokenAccountsByOwner,eth_getBalance,eth_getBlockByNumber,eth_call').transform((val) => val.split(',').map((m) => m.trim())),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const parseConfig = () => {
  const parsed = configSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('❌ Invalid environment configuration:', parsed.error.format());
    process.exit(1);
  }

  return parsed.data;
};

export const config = parseConfig();
