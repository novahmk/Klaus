// src/infra/memory/pipeline-status.ts
import { query } from '../database/pool';
import { logger } from '../../components/shared/logger';

/**
 * Etapas do pipeline de processamento de uma mensagem.
 * Sequência esperada: recebida → enfileirada → processando_ia → enviada.
 * Quando o lead está em atendimento humano, registra `controle_manual`.
 * `erro` pode ser registrado em qualquer ponto de falha.
 */
export type EtapaPipeline =
  | 'recebida'
  | 'enfileirada'
  | 'processando_ia'
  | 'controle_manual'
  | 'enviada'
  | 'erro';

export interface RegistroEtapa {
  etapa: EtapaPipeline;
  messageId?: string | null;
  correlationId?: string | null;
  leadId?: string | null;
  clienteId?: string | null;
  jobId?: string | null;
  erroDetalhe?: string | null;
}

/**
 * Registra (append-only) uma transição de etapa do pipeline.
 * Não bloqueia o fluxo: falhas de persistência são apenas logadas.
 */
export async function registrarEtapa(registro: RegistroEtapa): Promise<void> {
  try {
    await query(
      `INSERT INTO pipeline_status
         (message_id, correlation_id, lead_id, cliente_id, etapa, erro_detalhe, job_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        registro.messageId ?? null,
        registro.correlationId ?? registro.messageId ?? null,
        registro.leadId ?? null,
        registro.clienteId ?? null,
        registro.etapa,
        registro.erroDetalhe ?? null,
        registro.jobId ?? null
      ]
    );
  } catch (e) {
    logger.warn(
      { erro: (e as Error).message, etapa: registro.etapa },
      'pipeline-status: registrarEtapa falhou'
    );
  }
}
