/**
 * Sprint 1: Cache em Memória com TTL
 * Cache simples sem dependência externa (Redis optional em Sprints futuros).
 */

import { logger } from '../components/shared/logger';

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Gerenciador de cache em memória com TTL configurável.
 */
export class MemoryCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private defaultTtlMs: number;

  constructor(defaultTtlMs = 300_000) {
    // Default 5 minutos
    this.defaultTtlMs = defaultTtlMs;
  }

  /**
   * Obtém valor do cache se ainda não expirou.
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Armazena valor no cache com TTL.
   */
  set<T>(key: string, value: T, ttlMs?: number): void {
    const expiresAt = Date.now() + (ttlMs ?? this.defaultTtlMs);
    this.cache.set(key, { value, expiresAt });
  }

  /**
   * Deleta entrada do cache.
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Limpa todo o cache.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Retorna número de entradas ativas (não expiradas).
   */
  size(): number {
    let count = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (Date.now() > entry.expiresAt) {
        this.cache.delete(key);
      } else {
        count++;
      }
    }
    return count;
  }

  /**
   * Retorna ou computa e armazena valor.
   */
  async getOrSet<T>(
    key: string,
    fn: () => Promise<T>,
    ttlMs?: number
  ): Promise<T | null> {
    const cached = this.get<T>(key);
    if (cached) return cached;

    try {
      const value = await fn();
      this.set(key, value, ttlMs);
      return value;
    } catch (err) {
      logger.warn(
        { key, erro: (err as Error).message },
        'Cache: falha ao computar valor'
      );
      return null;
    }
  }
}

/**
 * Instância singleton de cache global.
 */
const globalCache = new MemoryCache(
  parseInt(process.env.CONFIG_CACHE_TTL_MS || '300000', 10)
);

export function getGlobalCache(): MemoryCache {
  return globalCache;
}
