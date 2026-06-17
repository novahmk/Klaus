// src/infra/memory/conversation-repo.ts
import { query } from '../database/pool';
import { logger } from '../../components/shared/logger';

const MAX_HISTORY = parseInt(process.env.MAX_HISTORY_MESSAGES || '20', 10);
const COLD_CONTEXT_HOURS = parseFloat(process.env.COLD_CONTEXT_HOURS || '4');

export interface TurnoHistorico {
  role: string;
  conteudo: string;
}

/**
 * Carrega os últimos N turnos de uma conversa do PostgreSQL (ordem cronológica).
 */
export async function carregarHistorico(
  telefone: string,
  limite = MAX_HISTORY
): Promise<TurnoHistorico[]> {
  try {
    const result = await query<{ role: string; conteudo: string }>(
      `SELECT role, message AS conteudo
         FROM conversations
        WHERE phone = $1
        ORDER BY created_at DESC
        LIMIT $2`,
      [telefone, limite]
    );
    return (result.rows || []).reverse();
  } catch (e) {
    logger.warn(
      { erro: (e as Error).message },
      'conversation-repo: carregarHistorico falhou'
    );
    return [];
  }
}

/**
 * Persiste uma mensagem no PostgreSQL.
 */
export async function salvarMensagem(
  telefone: string,
  role: 'user' | 'assistant',
  conteudo: string,
  tipo = 'text'
): Promise<void> {
  if (!telefone || !role || !conteudo) return;
  try {
    await query(
      `INSERT INTO conversations (phone, role, message, media_type)
       VALUES ($1, $2, $3, $4)`,
      [telefone, role, String(conteudo).substring(0, 4000), tipo]
    );
  } catch (e) {
    logger.warn(
      { erro: (e as Error).message },
      'conversation-repo: salvarMensagem falhou'
    );
  }
}

/**
 * Verifica se uma mensagem já foi processada (deduplicação durável).
 */
export async function jaFoiProcessada(messageId: string): Promise<boolean> {
  if (!messageId) return false;
  try {
    const result = await query(
      `SELECT 1 FROM mensagens_processadas WHERE message_id = $1`,
      [messageId]
    );
    return (result.rows?.length || 0) > 0;
  } catch {
    // Tabela pode não existir durante init — não bloquear
    return false;
  }
}

/**
 * Marca uma mensagem como processada (idempotente).
 */
export async function marcarComoProcessada(messageId: string): Promise<void> {
  if (!messageId) return;
  try {
    await query(
      `INSERT INTO mensagens_processadas (message_id)
       VALUES ($1)
       ON CONFLICT DO NOTHING`,
      [messageId]
    );
  } catch (e) {
    logger.warn(
      { erro: (e as Error).message },
      'conversation-repo: marcarComoProcessada falhou'
    );
  }
}

/**
 * Retorna o timestamp da última mensagem de um número.
 */
export async function getUltimaMensagem(
  telefone: string
): Promise<Date | null> {
  try {
    const result = await query<{ created_at: Date }>(
      `SELECT created_at
         FROM conversations
        WHERE phone = $1
        ORDER BY created_at DESC
        LIMIT 1`,
      [telefone]
    );
    return result.rows?.[0]?.created_at || null;
  } catch {
    return null;
  }
}

/**
 * Retorna o número de horas de inatividade se exceder COLD_CONTEXT_HOURS.
 */
export async function getHorasDeContextoFrio(
  telefone: string
): Promise<number | null> {
  try {
    const ultima = await getUltimaMensagem(telefone);
    if (!ultima) return null;
    const horasParado = (Date.now() - new Date(ultima).getTime()) / 3_600_000;
    return horasParado >= COLD_CONTEXT_HOURS ? Math.round(horasParado) : null;
  } catch {
    return null;
  }
}

/**
 * Injeta instrução de "contexto frio" no system prompt quando o lead ficou
 * mais de COLD_CONTEXT_HOURS horas sem responder.
 */
export async function injetarContextoFrio(
  systemPrompt: string,
  telefone: string
): Promise<string> {
  try {
    const horasParado = await getHorasDeContextoFrio(telefone);
    if (horasParado) {
      return (
        systemPrompt +
        `\n\n[RETOMADA DE CONVERSA: Este lead ficou ${horasParado}h sem responder. ` +
        `Retome com gentileza, resgate brevemente o interesse anterior e ` +
        `ofereça um caminho claro para o próximo passo. Não repita perguntas já feitas.]`
      );
    }
  } catch {
    /* não crítico */
  }
  return systemPrompt;
}
