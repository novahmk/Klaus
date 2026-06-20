// src/components/8-filas/job-processor.ts
import { Worker, Job } from 'bullmq';
import { QueueName, KlausJobPayload, JobResult } from './types';
import { REDIS_CONNECTION_CONFIG, DEFAULT_QUEUE_CONFIG } from './constants';
import { QueueManager } from './queue-manager';
import { OrquestradorKlaus } from '../7-orquestracao/orchestrator';
import { Intencao } from '../1-deteccao-intencao/types';
import { registrarEtapa } from '../../infra/memory';
import { dispatchOutboundMessage } from '../../modules/outbound/dispatcher';
import { logger } from '../shared/logger';

function messageIdDe(job: Job<KlausJobPayload>): string | undefined {
  const id = job.data.metadata?.messageId;
  return typeof id === 'string' ? id : undefined;
}

export class JobProcessor {
  private workers: Map<QueueName, Worker> = new Map();

  constructor(
    private orquestrador: OrquestradorKlaus,
    private queueManager: QueueManager = QueueManager.getInstance()
  ) {}

  public start(): void {
    [QueueName.INBOUND_MESSAGES, QueueName.OUTBOUND_RESPONSES].forEach((queueName) => {
      const config = DEFAULT_QUEUE_CONFIG[queueName];
      const worker = new Worker(
        queueName,
        async (job: Job<KlausJobPayload>) => this.processJob(queueName, job),
        {
          connection: REDIS_CONNECTION_CONFIG,
          concurrency: config.concurrency
        }
      );

      worker.on('failed', (job, err) => {
        console.error(
          `[JOB FAILED] ID: ${job?.id} na fila ${queueName}: ${err.message}`
        );
        void this.handleFailedJob(queueName, job, err);
      });

      this.workers.set(queueName, worker);
    });
  }

  /**
   * Em falha definitiva (tentativas esgotadas), encaminha o job para a
   * Dead Letter Queue e registra a etapa de erro para auditoria.
   */
  private async handleFailedJob(
    queueName: QueueName,
    job: Job<KlausJobPayload> | undefined,
    err: Error
  ): Promise<void> {
    if (!job) return;

    const tentativas = job.attemptsMade ?? 0;
    const maxTentativas =
      job.opts?.attempts ?? DEFAULT_QUEUE_CONFIG[queueName].attempts;
    const messageId = messageIdDe(job);

    await registrarEtapa({
      etapa: 'erro',
      messageId,
      correlationId: messageId,
      leadId: job.data.leadId,
      clienteId: job.data.clienteId,
      jobId: job.id,
      erroDetalhe: err.message
    });

    // Só envia para a DLQ quando as tentativas se esgotaram.
    if (tentativas < maxTentativas) return;

    try {
      await this.queueManager.addJob(QueueName.DEAD_LETTER, {
        leadId: job.data.leadId,
        clienteId: job.data.clienteId,
        mensagem: job.data.mensagem,
        timestamp: new Date(),
        metadata: {
          ...job.data.metadata,
          filaOrigem: queueName,
          jobIdOrigem: job.id,
          tentativas,
          erro: err.message
        }
      });
      logger.error(
        { queueName, jobId: job.id, messageId, tentativas, erro: err.message },
        'DLQ: job movido para dead_letter após esgotar tentativas'
      );
    } catch (dlqErr) {
      logger.error(
        { queueName, jobId: job.id, erro: (dlqErr as Error).message },
        'DLQ: falha ao mover job para dead_letter'
      );
    }
  }

  private async processJob(
    queueName: QueueName,
    job: Job<KlausJobPayload>
  ): Promise<JobResult> {
    if (queueName === QueueName.OUTBOUND_RESPONSES) {
      return this.processOutbound(job);
    }

    if (queueName === QueueName.NOTIFICATION_ALERTS) {
      return {
        success: true,
        processingTime: 0
      };
    }

    return this.processInbound(job);
  }

  private async processInbound(job: Job<KlausJobPayload>): Promise<JobResult> {
    const startTime = Date.now();
    const messageId = messageIdDe(job);
    console.log(
      `[JOB START] Processando job ${job.id} para lead ${job.data.leadId}`
    );

    await registrarEtapa({
      etapa: 'processando_ia',
      messageId,
      correlationId: messageId,
      leadId: job.data.leadId,
      clienteId: job.data.clienteId,
      jobId: job.id
    });

    try {
      const resultado = await this.orquestrador.processar({
        id: job.id || job.data.leadId,
        texto: job.data.mensagem,
        leadId: job.data.leadId,
        clienteId: job.data.clienteId,
        metadata: { ...job.data.metadata, timestamp: job.data.timestamp }
      });

      const to =
        String(job.data.metadata?.from || job.data.metadata?.to || '') ||
        job.data.leadId;

      if (resultado.texto) {
        await this.queueManager.addJob(
          QueueName.OUTBOUND_RESPONSES,
          {
            leadId: job.data.leadId,
            clienteId: job.data.clienteId,
            mensagem: resultado.texto,
            timestamp: new Date(),
            metadata: {
              ...job.data.metadata,
              to,
              origemJobId: job.id,
              intencaoDetectada: resultado.intencaoDetectada,
              scoreQualificacao: resultado.scoreQualificacao
            }
          },
          0
        );
      }

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

  private async processOutbound(job: Job<KlausJobPayload>): Promise<JobResult> {
    const startTime = Date.now();
    const to =
      String(job.data.metadata?.to || job.data.metadata?.from || '') ||
      job.data.leadId;

    try {
      await dispatchOutboundMessage({
        leadId: job.data.leadId,
        clienteId: job.data.clienteId,
        mensagem: job.data.mensagem,
        to,
        messageId: messageIdDe(job),
        correlationId: messageIdDe(job),
        jobId: job.id,
        origem: 'queue_outbound'
      });
      logger.info(
        { leadId: job.data.leadId, to, jobId: job.id },
        'OUTBOUND: resposta enviada via WASenderAPI'
      );

      return {
        success: true,
        respostaGerada: job.data.mensagem,
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      throw new Error(
        `Falha no envio outbound: ${(error as Error).message}`
      );
    }
  }
}
