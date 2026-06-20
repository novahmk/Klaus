// src/integrations/wasender/processor.ts
import { wasenderConfig } from './config';
import { QueueName, KlausJobPayload } from '../../components/8-filas/types';
import { logger } from '../../components/shared/logger';

export interface MensagemRecebida {
  from: string;
  texto: string;
  pushName: string;
  leadId: string;
  clienteId: string;
  messageId: string;
}

/** Contrato mínimo do Orquestrador para o modo 'direct'. */
export interface OrquestradorLike {
  processar(msg: {
    id: string;
    texto: string;
    leadId: string;
    clienteId: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ texto: string }>;
}

/** Contrato mínimo do QueueManager para o modo 'queue'. */
export interface QueueManagerLike {
  addJob(
    queueName: QueueName,
    payload: KlausJobPayload,
    priority?: number
  ): Promise<unknown>;
}

/**
 * Resultado explícito do processamento, para o webhook decidir a marcação
 * de idempotência somente após sucesso real (enqueue ou processamento direto).
 */
export interface ResultadoProcessamento {
  /** true quando a mensagem foi enfileirada com sucesso (modo 'queue'). */
  enfileirada: boolean;
  /** Id do job criado na fila, quando disponível. */
  jobId?: string;
  /** Texto de resposta no modo 'direct' (null/undefined no modo 'queue'). */
  resposta?: string | null;
}

let _orquestrador: OrquestradorLike | null = null;
let _queueManager: QueueManagerLike | null = null;

/**
 * Injeta as dependências de processamento (orquestrador e/ou fila).
 */
export function configurarProcessor(deps: {
  orquestrador?: OrquestradorLike;
  queueManager?: QueueManagerLike;
}): void {
  if (deps.orquestrador) _orquestrador = deps.orquestrador;
  if (deps.queueManager) _queueManager = deps.queueManager;
}

/**
 * Processa uma mensagem recebida.
 * - modo 'queue': enfileira no Comp. 8 (INBOUND_MESSAGES) e retorna null
 *   (a resposta ao lead é enviada de forma assíncrona pelo worker OUTBOUND).
 * - modo 'direct': chama o Orquestrador e retorna o texto da resposta.
 */
export async function processarMensagem(
  msg: MensagemRecebida
): Promise<ResultadoProcessamento> {
  if (wasenderConfig.PROCESSING_MODE === 'queue') {
    if (!_queueManager) {
      // Nunca descartar silenciosamente: erro explícito impede que a
      // mensagem seja marcada como processada e permite reprocessamento.
      logger.error(
        { leadId: msg.leadId, messageId: msg.messageId },
        'Processor: QueueManager não configurado — mensagem não enfileirada'
      );
      throw new Error(
        'QueueManager não inicializado — mensagem não enfileirada'
      );
    }
    const payload: KlausJobPayload = {
      leadId: msg.leadId,
      clienteId: msg.clienteId,
      mensagem: msg.texto,
      timestamp: new Date(),
      metadata: { from: msg.from, pushName: msg.pushName, messageId: msg.messageId }
    };
    const job = (await _queueManager.addJob(
      QueueName.INBOUND_MESSAGES,
      payload,
      0
    )) as { id?: string } | undefined;
    const jobId = job?.id;
    logger.info(
      { leadId: msg.leadId, messageId: msg.messageId, jobId },
      'Processor: mensagem enfileirada (INBOUND)'
    );
    return { enfileirada: true, jobId, resposta: null };
  }

  // modo 'direct'
  if (!_orquestrador) {
    logger.error(
      { leadId: msg.leadId, messageId: msg.messageId },
      'Processor: Orquestrador não configurado — mensagem não processada'
    );
    throw new Error(
      'Orquestrador não inicializado — mensagem não processada'
    );
  }
  const resultado = await _orquestrador.processar({
    id: msg.messageId,
    texto: msg.texto,
    leadId: msg.leadId,
    clienteId: msg.clienteId,
    metadata: { from: msg.from, pushName: msg.pushName }
  });
  return { enfileirada: false, resposta: resultado.texto };
}
