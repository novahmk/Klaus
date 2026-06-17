// src/components/7-orquestracao/cache-manager.ts
import Redis from 'ioredis';
import crypto from 'crypto';
import { ORCHESTRATOR_CONFIG } from './constants';

export class CacheManager {
  constructor(private redis: Redis) {}

  gerarChave(leadId: string, texto: string): string {
    const hash = crypto.createHash('sha256').update(texto).digest('hex');
    return `${ORCHESTRATOR_CONFIG.CACHE.PREFIXO}${leadId}:${hash}`;
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async set(
    key: string,
    value: unknown,
    ttl = ORCHESTRATOR_CONFIG.CACHE.TTL_PADRAO
  ): Promise<void> {
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }
}
