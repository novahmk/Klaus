// ============================================================
// COMPONENT 8 — Queue System (BullMQ)
// ============================================================

import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { Orchestrator } from '../orchestrator';
import { IncomingMessageJob, HandoffJob } from '../../types';

// Queue names
export const QUEUE_NAMES = {
  INCOMING_MESSAGES: 'incoming-messages',
  HANDOFF: 'handoff',
} as const;

// Job priorities
export const JOB_PRIORITIES = {
  HIGH: 1,
  NORMAL: 5,
  LOW: 10,
} as const;

const CONNECTION = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
};

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 2000,
  },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 500 },
};

// ---- Queues ------------------------------------------------

let incomingMessagesQueue: Queue<IncomingMessageJob> | null = null;
let handoffQueue: Queue<HandoffJob> | null = null;

export function getIncomingMessagesQueue(): Queue<IncomingMessageJob> {
  if (!incomingMessagesQueue) {
    incomingMessagesQueue = new Queue<IncomingMessageJob>(
      QUEUE_NAMES.INCOMING_MESSAGES,
      { connection: CONNECTION, defaultJobOptions: DEFAULT_JOB_OPTIONS },
    );
  }
  return incomingMessagesQueue;
}

export function getHandoffQueue(): Queue<HandoffJob> {
  if (!handoffQueue) {
    handoffQueue = new Queue<HandoffJob>(QUEUE_NAMES.HANDOFF, {
      connection: CONNECTION,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
  }
  return handoffQueue;
}

// ---- Enqueue helpers ----------------------------------------

export async function enqueueIncomingMessage(
  payload: IncomingMessageJob,
  priority: number = JOB_PRIORITIES.NORMAL,
): Promise<void> {
  const queue = getIncomingMessagesQueue();
  await queue.add(payload.jobId, payload, { priority });
  logger.info('Message enqueued', { jobId: payload.jobId, leadId: payload.leadId, priority });
}

export async function enqueueHandoff(payload: HandoffJob): Promise<void> {
  const queue = getHandoffQueue();
  await queue.add(payload.jobId, payload, { priority: JOB_PRIORITIES.HIGH });
  logger.info('Handoff enqueued', { jobId: payload.jobId, leadId: payload.leadId });
}

// ---- Workers ------------------------------------------------

export function createIncomingMessagesWorker(
  orchestrator: Orchestrator,
  concurrency: number = 5,
): Worker<IncomingMessageJob> {
  const worker = new Worker<IncomingMessageJob>(
    QUEUE_NAMES.INCOMING_MESSAGES,
    async (job: Job<IncomingMessageJob>) => {
      logger.info('Processing incoming message job', {
        jobId: job.id,
        leadId: job.data.leadId,
        attempt: job.attemptsMade + 1,
      });

      const result = await orchestrator.process(job.data);

      if (result.shouldHandoff) {
        const { randomUUID } = await import('crypto');
        await enqueueHandoff({
          jobId: randomUUID(),
          leadId: result.updatedLead.id,
          score: result.qualificationScore,
          trigger: result.updatedLead.status as never,
          timestamp: new Date().toISOString(),
        });
      }

      return result;
    },
    { connection: CONNECTION, concurrency },
  );

  worker.on('completed', (job) => {
    logger.info('Job completed', { jobId: job.id, leadId: job.data.leadId });
  });

  worker.on('failed', (job, err) => {
    logger.error('Job failed', {
      jobId: job?.id,
      leadId: job?.data?.leadId,
      error: err.message,
      attemptsMade: job?.attemptsMade,
    });
  });

  worker.on('error', (err) => {
    logger.error('Worker error', { error: err.message });
  });

  return worker;
}

export function createHandoffWorker(
  concurrency: number = 2,
): Worker<HandoffJob> {
  const worker = new Worker<HandoffJob>(
    QUEUE_NAMES.HANDOFF,
    async (job: Job<HandoffJob>) => {
      logger.info('Processing handoff job', {
        jobId: job.id,
        leadId: job.data.leadId,
        score: job.data.score,
      });

      // Handoff processing: update lead status to TRANSFERRED
      const { query } = await import('../../db/connection');
      await query(
        `UPDATE leads SET status = 'TRANSFERRED', updated_at = NOW() WHERE id = $1`,
        [job.data.leadId],
      );

      logger.info('Lead transferred to sales team', { leadId: job.data.leadId });
      return { transferred: true, leadId: job.data.leadId };
    },
    { connection: CONNECTION, concurrency },
  );

  worker.on('completed', (job) => {
    logger.info('Handoff job completed', { jobId: job.id, leadId: job.data.leadId });
  });

  worker.on('failed', (job, err) => {
    logger.error('Handoff job failed', {
      jobId: job?.id,
      leadId: job?.data?.leadId,
      error: err.message,
    });
  });

  return worker;
}

// ---- Queue Events (monitoring) ------------------------------

export function createQueueEventsMonitor(): QueueEvents {
  const events = new QueueEvents(QUEUE_NAMES.INCOMING_MESSAGES, {
    connection: CONNECTION,
  });

  events.on('waiting', ({ jobId }) => {
    logger.debug('Job waiting', { jobId });
  });

  events.on('active', ({ jobId }) => {
    logger.debug('Job active', { jobId });
  });

  events.on('stalled', ({ jobId }) => {
    logger.warn('Job stalled', { jobId });
  });

  return events;
}
