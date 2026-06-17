// src/components/8-filas/job-processor.ts
import { Worker, Job } from 'bullmq';
import { QueueName, KlausJobPayload, JobResult } from './types';
import { REDIS_CONNECTION_CONFIG, DEFAULT_QUEUE_CONFIG } from './constants';
import { OrquestradorKlaus } from '../7-orquestracao/orchestrator';
import { Intencao } from '../1-deteccao-intencao/types';

export class JobProcessor {
  private workers: Map<QueueName, Worker> = new Map();

  constructor(private orquestrador: OrquestradorKlaus) {}

  public start(): void {
    Object.values(QueueName).forEach((queueName) => {
      const config = DEFAULT_QUEUE_CONFIG[queueName];
      const worker = new Worker(
        queueName,
        async (job: Job<KlausJobPayload>) => this.processJob(job),
        {
          connection: REDIS_CONNECTION_CONFIG,
          concurrency: config.concurrency
        }
      );

      worker.on('failed', (job, err) => {
        console.error(
          `[JOB FAILED] ID: ${job?.id} na fila ${queueName}: ${err.message}`
        );
      });

      this.workers.set(queueName, worker);
    });
  }

  private async processJob(job: Job<KlausJobPayload>): Promise<JobResult> {
    const startTime = Date.now();
    console.log(
      `[JOB START] Processando job ${job.id} para lead ${job.data.leadId}`
    );

    try {
      const resultado = await this.orquestrador.processar({
        id: job.id || job.data.leadId,
        texto: job.data.mensagem,
        leadId: job.data.leadId,
        clienteId: job.data.clienteId,
        metadata: { timestamp: job.data.timestamp }
      });

      return {
        success: true,
        intencaoDetectada: resultado.intencaoDetectada as Intencao,
        respostaGerada: resultado.texto,
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      throw new Error(
        `Falha no processamento do orquestrador: ${(error as Error).message}`
      );
    }
  }
}
