import { logger } from '../utils/logger';

type PendingRequest = {
  promise: Promise<any>;
};

export class RequestCoalescer {
  private pending = new Map<string, PendingRequest>();

  public async execute<T>(key: string, task: () => Promise<T>): Promise<T> {
    const existing = this.pending.get(key);
    if (existing) {
      logger.info(`Coalescing request for key: ${key}`);
      return existing.promise;
    }

    const promise = task().finally(() => {
      this.pending.delete(key);
    });

    this.pending.set(key, { promise });
    return promise;
  }
}

export const requestCoalescer = new RequestCoalescer();
