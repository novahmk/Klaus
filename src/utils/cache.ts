// ============================================================
// REDIS CACHE UTILITY — Klaus V2
// ============================================================

import Redis from 'ioredis';
import { config } from '../config';
import { logger } from './logger';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      lazyConnect: true,
      enableOfflineQueue: false,
    });

    redisClient.on('error', (err) => {
      logger.error('Redis client error', { error: err.message });
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });
  }

  return redisClient;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const redis = getRedisClient();
    const value = await redis.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch (err) {
    logger.warn('Cache get failed', { key, error: (err as Error).message });
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds?: number,
): Promise<void> {
  try {
    const redis = getRedisClient();
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await redis.set(key, serialized, 'EX', ttlSeconds);
    } else {
      await redis.set(key, serialized);
    }
  } catch (err) {
    logger.warn('Cache set failed', { key, error: (err as Error).message });
  }
}

export async function cacheDel(key: string): Promise<void> {
  try {
    const redis = getRedisClient();
    await redis.del(key);
  } catch (err) {
    logger.warn('Cache del failed', { key, error: (err as Error).message });
  }
}

export function buildCacheKey(...parts: string[]): string {
  return parts.join(':');
}
