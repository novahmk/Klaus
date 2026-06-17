// src/components/4-ranking-objecoes/cache.ts
import Redis from 'ioredis';

export class CacheRanking {
  constructor(private redis: Redis) {}

  async getCachedRanking(key: string): Promise<string | null> {
    return await this.redis.get(`ranking:${key}`);
  }

  async setCachedRanking(key: string, value: unknown): Promise<void> {
    await this.redis.setex(`ranking:${key}`, 3600, JSON.stringify(value));
  }
}
