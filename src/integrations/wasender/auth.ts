// src/integrations/wasender/auth.ts
import crypto from 'crypto';
import type { Request } from 'express';
import { wasenderConfig } from './config';
import { logger } from '../../components/shared/logger';

/**
 * Comparação de strings resistente a timing attacks.
 */
export function safeCompare(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

/**
 * Valida a assinatura do webhook via X-Webhook-Signature.
 * Sem WEBHOOK_SECRET configurado, aceita qualquer requisição.
 */
export function autenticarWebhook(req: Request): boolean {
  if (!wasenderConfig.WEBHOOK_SECRET) return true;
  const signature = (req.header('x-webhook-signature') as string) || '';
  if (safeCompare(signature, wasenderConfig.WEBHOOK_SECRET)) return true;
  logger.warn('Auth: webhook rejeitado — X-Webhook-Signature inválido');
  return false;
}

/**
 * Gera um messageId de fallback (bucket de 5s) para deduplicação quando o
 * payload não traz um ID explícito.
 */
export function createFallbackMessageId(
  from: string,
  texto?: string | null,
  audioUrl?: string | null
): string {
  const fingerprint = String(texto || audioUrl || 'sem-conteudo').trim();
  const timeBucket = Math.floor(Date.now() / 5000);
  return crypto
    .createHash('md5')
    .update(`${from}|${fingerprint}|${timeBucket}`)
    .digest('hex');
}
