// src/components/8-filas/constants.ts
import { QueueConfig, QueueName } from './types';

export const DEFAULT_QUEUE_CONFIG: Record<QueueName, QueueConfig> = {
  [QueueName.INBOUND_MESSAGES]: {
    concurrency: 50,
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 2000 // 2 segundos base
    }
  },
  [QueueName.OUTBOUND_RESPONSES]: {
    concurrency: 30,
    attempts: 3,
    backoff: {
      type: 'fixed',
      delay: 5000
    }
  },
  [QueueName.NOTIFICATION_ALERTS]: {
    concurrency: 10,
    attempts: 2,
    backoff: {
      type: 'fixed',
      delay: 10000
    }
  }
};

function criarRedisConnectionConfig() {
  const baseConfig = {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  };

  if (!process.env.REDIS_URL) {
    return {
      ...baseConfig,
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379
    };
  }

  const redisUrl = new URL(process.env.REDIS_URL);
  const db = redisUrl.pathname.replace('/', '');

  return {
    ...baseConfig,
    host: redisUrl.hostname,
    port: Number(redisUrl.port) || 6379,
    username: redisUrl.username || undefined,
    password: redisUrl.password || undefined,
    db: db ? Number(db) : 0,
    tls: redisUrl.protocol === 'rediss:' ? {} : undefined
  };
}

export const REDIS_CONNECTION_CONFIG = criarRedisConnectionConfig();
