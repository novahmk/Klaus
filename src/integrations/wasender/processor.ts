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
): Promise<string | null> {
  if (wasenderConfig.PROCESSING_MODE === 'queue') {
    if (!_queueManager) {
      logger.warn('Processor: QueueManager não configurado — descartando');
      return null;
    }
    const payload: KlausJobPayload = {
      leadId: msg.leadId,
      clienteId: msg.clienteId,
      mensagem: msg.texto,
      timestamp: new Date(),
      metadata: { from: msg.from, pushName: msg.pushName, messageId: msg.messageId }
    };
    await _queueManager.addJob(QueueName.INBOUND_MESSAGES, payload, 0);
    logger.info({ leadId: msg.leadId }, 'Processor: mensagem enfileirada (INBOUND)');
    return null;
  }

  // modo 'direct'
  if (!_orquestrador) {
    logger.warn('Processor: Orquestrador não configurado — descartando');
    return null;
  }
  const resultado = await _orquestrador.processar({
    id: msg.messageId,
    texto: msg.texto,
    leadId: msg.leadId,
    clienteId: msg.clienteId,
    metadata: { from: msg.from, pushName: msg.pushName }
  });
  return resultado.texto;
}
