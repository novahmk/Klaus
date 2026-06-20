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
import {
  jaFoiProcessada,
  marcarComoProcessada,
  salvarMensagem,
  registrarEtapa
} from '../../infra/memory';
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
        await enviarMensagem(from, resultado.resposta);
        await salvarMensagem(leadId, 'assistant', resultado.resposta);
        await registrarEtapa({
          etapa: 'enviada',
          messageId,
          correlationId: messageId,
          leadId,
          clienteId
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
