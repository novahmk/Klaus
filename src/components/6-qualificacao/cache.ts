// src/components/6-qualificacao/cache.ts
import Redis from 'ioredis';

export class CacheQualificacao {
  private redis = new Redis();

  async set(leadId: string, data: unknown): Promise<void> {
    await this.redis.setex(`qual:${leadId}`, 3600, JSON.stringify(data));
  }
}
