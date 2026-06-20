// src/components/8-filas/queue-manager.ts
import { Queue, Job } from 'bullmq';
import { QueueName, KlausJobPayload } from './types';
import { DEFAULT_QUEUE_CONFIG, REDIS_CONNECTION_CONFIG } from './constants';
import IORedis from 'ioredis';

export class QueueManager {
  private static instance: QueueManager;
  private queues: Map<QueueName, Queue> = new Map();
  private connection: IORedis;

  private constructor() {
    this.connection = new IORedis(REDIS_CONNECTION_CONFIG);
    this.initializeQueues();
  }

  public static getInstance(): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager();
    }
    return QueueManager.instance;
  }

  private initializeQueues(): void {
    Object.values(QueueName).forEach((queueName) => {
      const config = DEFAULT_QUEUE_CONFIG[queueName];
      const queue = new Queue(queueName, {
        connection: this.connection,
        defaultJobOptions: {
          attempts: config.attempts,
          backoff: config.backoff,
          removeOnComplete: true,
          removeOnFail: false
        }
      });
      this.queues.set(queueName, queue);
    });
  }

  public async addJob(
    queueName: QueueName,
    payload: KlausJobPayload,
    priority = 0
  ): Promise<Job> {
    const queue = this.queues.get(queueName);
    if (!queue) throw new Error(`Fila ${queueName} não inicializada.`);
    return queue.add('process_message', payload, { priority });
  }

  public async getQueue(queueName: QueueName): Promise<Queue | undefined> {
    return this.queues.get(queueName);
  }

  public async healthPing(): Promise<string> {
    return this.connection.ping();
  }
}
