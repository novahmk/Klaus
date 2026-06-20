import { createHash } from 'node:crypto';
import IORedis from 'ioredis';
import { logger } from '../../components/shared/logger';
import { salvarMensagem, registrarEtapa } from '../../infra/memory';
import { enviarMensagem } from '../../integrations/wasender/client';
import {
  atualizarUltimaInteracaoSupabase,
  registrarMensagemOutboundSupabase
} from '../inbound/supabase-gateway';

interface DispatchInput {
  leadId: string;
  clienteId: string;
  mensagem: string;
  to?: string;
  messageId?: string;
  correlationId?: string;
  jobId?: string;
  origem?: string;
}

interface DispatchOutput {
  sent: boolean;
  deduplicated: boolean;
  idempotencyKey: string;
}

const OUTBOUND_IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;
const memoryLocks = new Map<string, number>();
let redisClient: IORedis | null = null;

function buildIdempotencyKey(input: DispatchInput): string {
  if (input.messageId) {
    return `outbound:idempotency:message:${input.messageId}`;
  }

  const hash = createHash('sha256')
    .update(
      JSON.stringify({
        leadId: input.leadId,
        clienteId: input.clienteId,
        to: input.to || input.leadId,
        mensagem: input.mensagem,
        origem: input.origem || 'unknown'
      })
    )
    .digest('hex');

  return `outbound:idempotency:hash:${hash}`;
}

function getRedisClient(): IORedis | null {
  if (redisClient) return redisClient;
  const url = process.env.REDIS_URL;
  if (!url) return null;

  redisClient = new IORedis(url, {
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
    lazyConnect: true
  });

  redisClient.on('error', (error) => {
    logger.warn(
      { erro: error.message },
      'OutboundDispatcher: falha no Redis de idempotencia (fallback em memoria)'
    );
  });

  return redisClient;
}

async function reserveIdempotencyKey(key: string): Promise<boolean> {
  const redis = getRedisClient();

  if (redis) {
    try {
      await redis.connect();
    } catch {
      // Já pode estar conectado; segue para operação.
    }

    try {
      const result = await redis.set(
        key,
        Date.now().toString(),
        'EX',
        OUTBOUND_IDEMPOTENCY_TTL_SECONDS,
        'NX'
      );
      return result === 'OK';
    } catch (error) {
      logger.warn(
        { erro: (error as Error).message, key },
        'OutboundDispatcher: falha ao reservar idempotencia no Redis (fallback em memoria)'
      );
    }
  }

  const now = Date.now();
  const current = memoryLocks.get(key);
  if (current && current > now) return false;

  memoryLocks.set(
    key,
    now + OUTBOUND_IDEMPOTENCY_TTL_SECONDS * 1000
  );
  return true;
}

export async function dispatchOutboundMessage(
  input: DispatchInput
): Promise<DispatchOutput> {
  const to = input.to || input.leadId;
  const idempotencyKey = buildIdempotencyKey(input);
  const reserved = await reserveIdempotencyKey(idempotencyKey);

  if (!reserved) {
    logger.info(
      {
        leadId: input.leadId,
        clienteId: input.clienteId,
        messageId: input.messageId,
        idempotencyKey,
        origem: input.origem
      },
      'OutboundDispatcher: envio duplicado ignorado por idempotencia'
    );

    return {
      sent: false,
      deduplicated: true,
      idempotencyKey
    };
  }

  await enviarMensagem(to, input.mensagem);
  await salvarMensagem(input.leadId, 'assistant', input.mensagem);
  await registrarMensagemOutboundSupabase({
    leadId: input.leadId,
    conteudo: input.mensagem,
    clienteId: input.clienteId,
    messageId: input.messageId
  });
  await atualizarUltimaInteracaoSupabase({
    leadId: input.leadId,
    ultimaMensagem: input.mensagem,
    clienteId: input.clienteId
  });
  await registrarEtapa({
    etapa: 'enviada',
    messageId: input.messageId,
    correlationId: input.correlationId || input.messageId,
    leadId: input.leadId,
    clienteId: input.clienteId,
    jobId: input.jobId
  });

  logger.info(
    {
      leadId: input.leadId,
      clienteId: input.clienteId,
      to,
      messageId: input.messageId,
      idempotencyKey,
      origem: input.origem
    },
    'OutboundDispatcher: mensagem enviada com sucesso'
  );

  return {
    sent: true,
    deduplicated: false,
    idempotencyKey
  };
}
