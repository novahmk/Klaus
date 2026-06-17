// ============================================================
// MAIN ENTRY POINT — Klaus V2
// ============================================================

import { logger } from './utils/logger';
import { Orchestrator } from './components/orchestrator';
import {
  createIncomingMessagesWorker,
  createHandoffWorker,
  createQueueEventsMonitor,
} from './components/queue-system';

async function main(): Promise<void> {
  logger.info('Klaus V2 starting...');

  const orchestrator = new Orchestrator();

  const messageWorker = createIncomingMessagesWorker(orchestrator, 5);
  const handoffWorker = createHandoffWorker(2);
  const monitor = createQueueEventsMonitor();

  logger.info('Klaus V2 started. Workers active.', {
    messageWorkerConcurrency: 5,
    handoffWorkerConcurrency: 2,
  });

  // Graceful shutdown
  async function shutdown(signal: string): Promise<void> {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    await Promise.all([messageWorker.close(), handoffWorker.close(), monitor.close()]);
    logger.info('All workers stopped. Exiting.');
    process.exit(0);
  }

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error('Fatal error during startup', { error: (err as Error).message });
  process.exit(1);
});
