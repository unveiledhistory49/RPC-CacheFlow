import Redis from 'ioredis';
import { config } from '../config';

class RedisService {
  private client: Redis;

  constructor() {
    this.client = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.client.on('error', (err) => {
      console.error('Redis connection error:', err);
    });

    this.client.on('connect', () => {
      console.log('Connected to Redis');
    });
  }

  public getClient(): Redis {
    return this.client;
  }

  public async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  public async set(key: string, value: string, ttlSeconds: number): Promise<string> {
    return this.client.set(key, value, 'EX', ttlSeconds);
  }
  
  public async incr(key: string): Promise<number> {
      return this.client.incr(key);
  }

  public async expire(key: string, seconds: number): Promise<number> {
      return this.client.expire(key, seconds);
  }

  public async zincrby(key: string, increment: number, member: string): Promise<string> {
    return this.client.zincrby(key, increment, member);
  }

  public async zrevrange(key: string, start: number, stop: number, withScores: boolean = false): Promise<string[]> {
    if (withScores) {
      return this.client.zrevrange(key, start, stop, 'WITHSCORES');
    }
    return this.client.zrevrange(key, start, stop);
  }

  public async del(key: string): Promise<number> {
    return this.client.del(key);
  }
  
  public async disconnect() {
    await this.client.quit();
  }
}

export const redisService = new RedisService();

if (process.env.NODE_ENV === 'test') {
  // In tests, we don't want the singleton to stay open.
  // Although mocking should prevent this, sometimes it doesn't if imports are messy.
  // We can't easily quit here because it might be needed by tests that DON'T mock it.
}
