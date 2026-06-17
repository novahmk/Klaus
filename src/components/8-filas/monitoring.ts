// src/components/8-filas/monitoring.ts
import { QueueManager } from './queue-manager';
import { QueueName } from './types';

export interface QueueMetrics {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  total: number;
}

export class QueueMonitoring {
  constructor(private queueManager: QueueManager) {}

  public async getMetrics(): Promise<Record<string, QueueMetrics>> {
    const metrics: Record<string, QueueMetrics> = {};

    for (const queueName of Object.values(QueueName)) {
      const queue = await this.queueManager.getQueue(queueName);
      if (queue) {
        const [waiting, active, completed, failed, delayed] =
          await Promise.all([
            queue.getWaitingCount(),
            queue.getActiveCount(),
            queue.getCompletedCount(),
            queue.getFailedCount(),
            queue.getDelayedCount()
          ]);

        metrics[queueName] = {
          waiting,
          active,
          completed,
          failed,
          delayed,
          total: waiting + active + completed + failed + delayed
        };
      }
    }

    return metrics;
  }
}
