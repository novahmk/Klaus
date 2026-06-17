// src/integrations/wasender/parser.ts

export interface AudioMessage {
  url?: string | null;
  mediaKey?: string | null;
  MediaKey?: string | null;
  _messageKey?: unknown;
  _type?: 'ptt' | 'audio';
  [campo: string]: unknown;
}

export interface PayloadParseado {
  from: string | null;
  texto: string | null;
  pushName: string;
  audioUrl: string | null;
  audioMessage: AudioMessage | null;
  messageId: string | null;
  webhookSessionId: string | null;
  fromMe?: boolean;
}

type WebhookBody = Record<string, any>;

/**
 * Extrai campos relevantes do corpo do webhook WASenderAPI.
 * Suporta os três formatos conhecidos: messages.received, data flat, body flat.
 */
export function parsePayloadWASender(body: WebhookBody): PayloadParseado {
  let from: string | null = null;
  let texto: string | null = null;
  let pushName = 'Cliente';
  let audioUrl: string | null = null;
  let audioMessage: AudioMessage | null = null;
  let messageId: string | null = null;
  let webhookSessionId: string | null = null;

  // ── Formato principal: data.messages (WASenderAPI messages.received) ──
  if (body.data?.messages) {
    const msg = body.data.messages;
    const key = msg.key || {};
    from = key.cleanedSenderPn || key.senderPn || key.remoteJid || null;
    texto =
      msg.messageBody ||
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      null;
    pushName = msg.pushName || body.data.pushName || 'Cliente';
    webhookSessionId = body.sessionId || null;
    messageId = key.id || null;

    if (msg.message?.audioMessage || msg.message?.pttMessage) {
      const isPtt = !!msg.message.pttMessage;
      audioMessage = msg.message.audioMessage || msg.message.pttMessage;
      if (audioMessage) {
        audioMessage._messageKey = key;
        audioMessage._type = isPtt ? 'ptt' : 'audio';
        audioUrl = audioMessage.url || null;
      }
    }

    if (key.fromMe === true) {
      return {
        from: null,
        texto: null,
        pushName,
        audioUrl: null,
        audioMessage: null,
        messageId: null,
        webhookSessionId,
        fromMe: true
      };
    }
  }

  // ── Formato alternativo: data flat ──
  if (!from && body.data) {
    const d = body.data;
    from = d.from || d.sender || d.phone || d.number || null;
    texto = d.message || d.body || d.text || d.messageBody || null;
    pushName = d.pushName || 'Cliente';
  }

  // ── Formato flat (corpo direto) ──
  if (!from && (body.from || body.sender || body.phone)) {
    from = body.from || body.sender || body.phone;
    texto = body.message || body.body || body.text || null;
    pushName = body.pushName || 'Cliente';
  }

  return {
    from,
    texto,
    pushName,
    audioUrl,
    audioMessage,
    messageId,
    webhookSessionId
  };
}
