// src/integrations/wasender/webhook-server.ts
import express, {
  Express,
  Request,
  Response,
  NextFunction
} from 'express';
import { wasenderConfig } from './config';
import { enviarMensagem } from './client';
import { autenticarWebhook, createFallbackMessageId } from './auth';
import { checarRateLimitIp, checarRateLimitTelefone } from './rate-limit';
import { parsePayloadWASender } from './parser';
import { transcribeAudioViaWASender } from './transcription';
import { processarMensagem } from './processor';
import { QueueManager } from '../../components/8-filas/queue-manager';
import { QueueName } from '../../components/8-filas/types';
import {
  jaFoiProcessada,
  marcarComoProcessada,
  salvarMensagem,
  registrarEtapa
} from '../../infra/memory';
import {
  isControleManualAtivo,
  registrarMensagemInboundSupabase
} from '../../modules/inbound/supabase-gateway';
import { dispatchOutboundMessage } from '../../modules/outbound/dispatcher';
import {
  getProspeccaoContract,
  normalizeManualDispatchRequest
} from '../../modules/prospeccao/contract';
import {
  checkDuplicateLeads,
  importLeadsBulk,
  registrarAuditoriaDisparo
} from '../../modules/prospeccao/service';
import { logger } from '../../components/shared/logger';
import { attach as attachHealth } from '../../infra/health';

const EVENTOS_IGNORADOS = new Set([
  'messages.upsert',
  'message.sent',
  'messages.update',
  'chats.update',
  'contacts.update',
  'messages-personal.received'
]);

const AVISO_AUDIO_FALLBACK =
  'Recebi seu áudio! 🎙️ No momento processo melhor mensagens de texto. Pode escrever o que precisa?';
const AVISO_MIDIA =
  'Recebi sua mensagem! Por enquanto processo melhor textos e áudios. Pode me escrever o que precisa? 😊';

function clientIpDe(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  const first = Array.isArray(xff) ? xff[0] : xff?.split(',')[0];
  return first?.trim() || req.socket?.remoteAddress || 'unknown';
}

function internalKeyFromReq(req: Request): string {
  const headerKey = req.header('x-internal-api-key') || '';
  if (headerKey) return headerKey;

  const auth = req.header('authorization') || '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }

  return '';
}

function authorizeInternal(req: Request, res: Response): boolean {
  const expectedKey = (process.env.INTERNAL_API_KEY || '').trim();
  if (!expectedKey) return true;

  const received = internalKeyFromReq(req);
  if (received === expectedKey) return true;

  res.status(403).json({ error: 'unauthorized' });
  return false;
}

/**
 * Cria o app Express com as rotas do WASenderAPI (não inicia o servidor).
 */
export function criarApp(): Express {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  app.get('/', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'WASender Core',
      wasenderApi: Boolean(wasenderConfig.TOKEN),
      webhookSecret: Boolean(wasenderConfig.WEBHOOK_SECRET),
      openai: Boolean(wasenderConfig.OPENAI_API_KEY),
      time: new Date().toISOString()
    });
  });

  attachHealth(app);

  app.get('/webhook', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', webhook: 'active' });
  });

  app.get('/api/prospeccao/contract', (req: Request, res: Response) => {
    if (!authorizeInternal(req, res)) return;
    res.status(200).json(getProspeccaoContract());
  });

  app.post('/api/prospeccao/manual-disparos', async (req: Request, res: Response) => {
    if (!authorizeInternal(req, res)) return;

    let normalized;
    try {
      normalized = normalizeManualDispatchRequest(req.body);
    } catch (error) {
      return res.status(400).json({
        accepted: false,
        error: (error as Error).message
      });
    }

    const queueManager = QueueManager.getInstance();
    const results = await Promise.all(
      normalized.itens.map(async (item) => {
        try {
          const job = await queueManager.addJob(
            QueueName.OUTBOUND_RESPONSES,
            {
              leadId: item.leadId,
              clienteId: normalized.clienteId,
              mensagem: item.mensagem,
              timestamp: new Date(),
              metadata: {
                ...item.metadata,
                to: item.telefoneE164,
                pushName: item.nome,
                origem: normalized.origem,
                correlationId: normalized.correlationId,
                messageId: `${normalized.correlationId}-${item.index}`
              }
            },
            1
          );

          return {
            index: item.index,
            leadId: item.leadId,
            to: item.telefoneE164,
            status: 'enqueued',
            jobId: job.id
          };
        } catch (error) {
          return {
            index: item.index,
            leadId: item.leadId,
            to: item.telefoneE164,
            status: 'failed',
            error: (error as Error).message
          };
        }
      })
    );

    const enqueued = results.filter((r) => r.status === 'enqueued').length;
    const failed = results.length - enqueued;

    logger.info(
      {
        clienteId: normalized.clienteId,
        origem: normalized.origem,
        correlationId: normalized.correlationId,
        total: normalized.itens.length,
        enqueued,
        failed
      },
      'Prospeccao: disparo manual em lote recebido'
    );

    await registrarAuditoriaDisparo({
      correlationId: normalized.correlationId,
      clienteId: normalized.clienteId,
      origem: normalized.origem,
      total: normalized.itens.length,
      enqueued,
      failed,
      payload: req.body,
      resultado: results
    });

    return res.status(202).json({
      accepted: failed < normalized.itens.length,
      total: normalized.itens.length,
      enqueued,
      failed,
      correlationId: normalized.correlationId,
      results
    });
  });

  app.post('/api/prospeccao/check-duplicados', async (req: Request, res: Response) => {
    if (!authorizeInternal(req, res)) return;

    const telefones = Array.isArray(req.body?.telefones)
      ? (req.body.telefones as string[])
      : [];

    if (!telefones.length) {
      return res.status(400).json({
        error: 'telefones deve conter ao menos 1 item'
      });
    }

    const resultado = await checkDuplicateLeads({ telefones });
    return res.status(200).json(resultado);
  });

  app.post('/api/prospeccao/importar-leads', async (req: Request, res: Response) => {
    if (!authorizeInternal(req, res)) return;

    try {
      const resultado = await importLeadsBulk({
        clienteId: req.body?.clienteId,
        origem: req.body?.origem,
        correlationId: req.body?.correlationId,
        itens: req.body?.itens
      });

      logger.info(
        {
          correlationId: resultado.correlationId,
          total: resultado.total,
          imported: resultado.imported,
          duplicatesInFile: resultado.duplicatesInFile,
          duplicatesInDb: resultado.duplicatesInDb,
          invalid: resultado.invalid
        },
        'Prospeccao: importacao CSV processada'
      );

      return res.status(202).json(resultado);
    } catch (error) {
      return res.status(400).json({
        accepted: false,
        error: (error as Error).message
      });
    }
  });

  app.post('/webhook', async (req: Request, res: Response) => {
    const reqId = Date.now().toString(36);

    // P1: Content-Type
    const ct = req.headers['content-type'] || '';
    if (!ct.includes('application/json')) {
      return res
        .status(415)
        .json({ error: 'Content-Type deve ser application/json' });
    }

    // P2: Rate limit por IP
    const ip = clientIpDe(req);
    if (!checarRateLimitIp(ip)) {
      return res.status(429).json({ error: 'Too Many Requests' });
    }

    // P3: Autenticação
    if (!autenticarWebhook(req)) {
      return res.status(403).json({ status: 'unauthorized' });
    }

    // Responder rápido (WASenderAPI exige resposta imediata)
    res.status(200).json({ status: 'received' });

    // Correlação acessível no catch para registrar a etapa de erro.
    let correlMessageId: string | undefined;
    let correlLeadId: string | undefined;

    try {
      // P4: Ignorar eventos internos
      const event = req.body?.event;
      if (event && EVENTOS_IGNORADOS.has(event)) {
        logger.debug({ reqId, event }, 'Webhook: evento ignorado');
        return;
      }

      // P5: Parsear payload
      const parsed = parsePayloadWASender(req.body || {});
      if (parsed.fromMe) return;

      let { from, texto } = parsed;
      const { pushName, audioUrl, audioMessage } = parsed;
      let { messageId } = parsed;
      if (!from) {
        logger.warn({ reqId }, 'Webhook: sem campo "from"');
        return;
      }

      // P6: Normalizar E.164
      from = String(from)
        .replace(/@s\.whatsapp\.net$/, '')
        .replace(/@lid$/, '')
        .replace(/^whatsapp:/, '')
        .replace(/[\s()-]/g, '')
        .trim();
      if (from && !from.startsWith('+')) from = '+' + from;

      // P7: messageId de fallback
      if (!messageId) {
        messageId = createFallbackMessageId(from, texto, audioUrl);
      }

      // P8: Deduplicação (Postgres durável)
      if (await jaFoiProcessada(messageId)) {
        logger.debug({ reqId, messageId }, 'Webhook: duplicata ignorada');
        return;
      }

      // P9: Sem texto — tentar transcrever áudio
      if (!texto?.trim()) {
        if (audioUrl && audioMessage && wasenderConfig.OPENAI_API_KEY) {
          try {
            const transcription = await transcribeAudioViaWASender({
              audioMessage,
              phoneNumber: from,
              sessionId: parsed.webhookSessionId,
              outputDir: '/tmp/wasender_audio'
            });
            texto = transcription.text;
          } catch (transcribeErr) {
            logger.warn(
              { reqId, erro: (transcribeErr as Error).message },
              'Webhook: transcrição falhou'
            );
            await enviarMensagem(from, AVISO_AUDIO_FALLBACK);
            return;
          }
        } else if (audioUrl && audioMessage) {
          await enviarMensagem(from, AVISO_AUDIO_FALLBACK);
          return;
        } else {
          await enviarMensagem(from, AVISO_MIDIA);
          return;
        }
      }

      texto = (texto || '').trim();

      // P10: Rate limit por telefone
      if (!checarRateLimitTelefone(from)) {
        logger.warn({ reqId, from }, 'Webhook: rate limit telefone');
        return;
      }

      // P11: Persistir mensagem do usuário (auditoria do recebido)
      const leadId = from.replace(/[^0-9]/g, '');
      const clienteId =
        (req.body?.clienteId as string) ||
        process.env.DEFAULT_CLIENTE_ID ||
        'default';
      correlMessageId = messageId;
      correlLeadId = leadId;

      await salvarMensagem(leadId, 'user', texto);
      await registrarEtapa({
        etapa: 'recebida',
        messageId,
        correlationId: messageId,
        leadId,
        clienteId
      });

      // Sprint 2: dual-write inbound em Supabase (best effort, não bloqueante)
      await registrarMensagemInboundSupabase({
        leadId,
        conteudo: texto,
        clienteId,
        messageId
      });

      // Sprint 2: se conversa está em controle manual, não aciona IA.
      const controleManualAtivo = await isControleManualAtivo(leadId);
      if (controleManualAtivo) {
        logger.info(
          { reqId, leadId, messageId },
          'Webhook: conversa em controle manual — IA não acionada'
        );

        await registrarEtapa({
          etapa: 'controle_manual',
          messageId,
          correlationId: messageId,
          leadId,
          clienteId
        });

        await marcarComoProcessada(messageId);
        return;
      }

      // P12: Processar (enfileira em modo 'queue' ou responde em 'direct')
      const resultado = await processarMensagem({
        from,
        texto,
        pushName,
        leadId,
        clienteId,
        messageId
      });

      if (resultado.enfileirada) {
        await registrarEtapa({
          etapa: 'enfileirada',
          messageId,
          correlationId: messageId,
          leadId,
          clienteId,
          jobId: resultado.jobId
        });
      }

      // P13: Em modo 'direct', enviar resposta e persistir
      if (resultado.resposta) {
        await dispatchOutboundMessage({
          leadId,
          clienteId,
          mensagem: resultado.resposta,
          to: from,
          messageId,
          correlationId: messageId,
          origem: 'webhook_direct'
        });
        logger.info({ reqId, from }, 'Webhook: resposta enviada');
      }

      // P14: Marcar idempotência SOMENTE após sucesso (enqueue ou direct).
      // Se o processamento falhar acima, a exceção impede a marcação e a
      // mensagem permanece reprocessável.
      await marcarComoProcessada(messageId);
    } catch (error) {
      await registrarEtapa({
        etapa: 'erro',
        messageId: correlMessageId,
        correlationId: correlMessageId,
        leadId: correlLeadId,
        erroDetalhe: (error as Error).message
      });
      logger.error(
        { reqId, erro: (error as Error).message },
        'Webhook: erro no processamento'
      );
    }
  });

  // Fallback de erro
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error({ erro: err.message }, 'Webhook: erro não tratado');
    if (!res.headersSent) res.status(500).json({ error: 'internal' });
  });

  return app;
}

/**
 * Inicia o servidor HTTP (chamar apenas no entrypoint).
 */
export function iniciarServidor(): void {
  const app = criarApp();
  const server = app.listen(wasenderConfig.PORT, '0.0.0.0', () => {
    logger.info(
      {
        port: wasenderConfig.PORT,
        baseUrl: wasenderConfig.BASE_URL,
        mode: wasenderConfig.PROCESSING_MODE,
        token: Boolean(wasenderConfig.TOKEN),
        openai: Boolean(wasenderConfig.OPENAI_API_KEY)
      },
      'WASender Core iniciado'
    );
  });

  server.on('error', (err) => {
    logger.error({ erro: err.message }, 'Falha ao iniciar servidor');
    process.exit(1);
  });
}
