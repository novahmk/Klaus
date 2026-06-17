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

export const REDIS_CONNECTION_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  maxRetriesPerRequest: null,
  enableReadyCheck: false
};
