// src/infra/memory/state-adapter.ts
import Redis from 'ioredis';
import { logger } from '../../components/shared/logger';

let _redis: Redis | null = null;
let _redisTentado = false;

function getRedis(): Redis | null {
  if (_redisTentado) return _redis;
  _redisTentado = true;

  const url = process.env.REDIS_URL;
  if (!url) return null;

  try {
    _redis = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      reconnectOnError: () => true
    });
    _redis.connect().catch((e: Error) => {
      logger.warn(
        { erro: e.message },
        'StateAdapter: Redis indisponível, usando in-memory'
      );
      _redis = null;
    });
    _redis.on('error', () => {
      /* erros silenciados — fallback in-memory */
    });
  } catch (erro) {
    logger.warn(
      { erro: String(erro) },
      'StateAdapter: ioredis indisponível, usando in-memory'
    );
    _redis = null;
  }

  return _redis;
}

export interface StateAdapter<T = unknown> {
  get(id: string): Promise<T | null>;
  set(id: string, value: T): Promise<void>;
  has(id: string): Promise<boolean>;
  delete(id: string): Promise<void>;
  size(): number;
}

/**
 * Cria um adapter de estado de curto prazo (async-only).
 * Backend Redis quando REDIS_URL estiver configurado; caso contrário Map local.
 *
 * @param namespace prefixo das chaves no Redis (ex: 'hist', 'intent')
 * @param ttlSeconds TTL das chaves no Redis (default: 24h)
 */
export function createAdapter<T = unknown>(
  namespace: string,
  ttlSeconds = 86400
): StateAdapter<T> {
  const local = new Map<string, T>();
  const redisKey = (id: string): string => `klaus:${namespace}:${id}`;

  return {
    async get(id: string): Promise<T | null> {
      if (local.has(id)) return local.get(id) ?? null;

      const redis = getRedis();
      if (redis) {
        try {
          const raw = await redis.get(redisKey(id));
          if (raw) {
            const val = JSON.parse(raw) as T;
            local.set(id, val); // warm cache
            return val;
          }
        } catch {
          /* fallback silencioso */
        }
      }
      return null;
    },

    async set(id: string, value: T): Promise<void> {
      local.set(id, value);
      const redis = getRedis();
      if (redis) {
        try {
          await redis.set(
            redisKey(id),
            JSON.stringify(value),
            'EX',
            ttlSeconds
          );
        } catch {
          /* fallback silencioso */
        }
      }
    },

    async has(id: string): Promise<boolean> {
      if (local.has(id)) return true;
      const redis = getRedis();
      if (redis) {
        try {
          return (await redis.exists(redisKey(id))) === 1;
        } catch {
          /* fallback silencioso */
        }
      }
      return false;
    },

    async delete(id: string): Promise<void> {
      local.delete(id);
      const redis = getRedis();
      if (redis) {
        try {
          await redis.del(redisKey(id));
        } catch {
          /* fallback silencioso */
        }
      }
    },

    size(): number {
      return local.size;
    }
  };
}

/**
 * Adapters pré-criados: histórico de chat (6h) e intenções (24h).
 */
export const chatHistoriesAdapter = createAdapter('hist', 6 * 3600);
export const customerIntentsAdapter = createAdapter('intent', 24 * 3600);
