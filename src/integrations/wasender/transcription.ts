// src/integrations/wasender/transcription.ts
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { OpenAI, toFile } from 'openai';
import { wasenderConfig } from './config';
import { AudioMessage } from './parser';
import { logger } from '../../components/shared/logger';

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    if (!wasenderConfig.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY não configurada');
    }
    _openai = new OpenAI({ apiKey: wasenderConfig.OPENAI_API_KEY });
  }
  return _openai;
}

/**
 * Baixa um arquivo de uma URL com suporte a redirecionamentos.
 */
export function downloadFile(
  sourceUrl: string,
  destinationPath: string,
  requestOptions: https.RequestOptions = {},
  redirectCount = 0
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      reject(new Error('Download falhou: redirecionamentos em excesso'));
      return;
    }

    const client = sourceUrl.startsWith('https') ? https : http;
    const request = client.get(sourceUrl, requestOptions, (res) => {
      const status = res.statusCode || 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        downloadFile(
          res.headers.location,
          destinationPath,
          requestOptions,
          redirectCount + 1
        )
          .then(resolve)
          .catch(reject);
        return;
      }

      if (status !== 200) {
        res.resume();
        reject(new Error(`Download falhou: HTTP ${status}`));
        return;
      }

      const fileStream = fs.createWriteStream(destinationPath);
      res.pipe(fileStream);
      fileStream.on('finish', () => fileStream.close(() => resolve()));
      fileStream.on('error', (err) => {
        fs.unlink(destinationPath, () => reject(err));
      });
    });

    request.on('error', reject);
  });
}

export interface TranscricaoResult {
  text: string;
  language: string;
  confidence: string;
  transcriptionLatency: number;
}

export interface TranscreverParams {
  audioMessage: AudioMessage;
  phoneNumber: string;
  sessionId?: string | null;
  outputDir?: string;
}

/**
 * Transcreve áudio recebido via WASenderAPI:
 *   1. POST /decrypt-media → publicUrl do OGG descriptografado
 *   2. Download do OGG → transcrição via OpenAI Whisper
 */
export async function transcribeAudioViaWASender({
  audioMessage,
  phoneNumber,
  sessionId,
  outputDir = '/tmp/wasender_audio'
}: TranscreverParams): Promise<TranscricaoResult> {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const audioPath = path.join(outputDir, `audio_${Date.now()}.ogg`);
  const encUrl = audioMessage.url || null;
  const mediaKey = audioMessage.mediaKey || audioMessage.MediaKey || null;

  if (!encUrl || !mediaKey) {
    throw new Error(
      `Áudio sem url ou mediaKey no payload (url=${!!encUrl}, mediaKey=${!!mediaKey})`
    );
  }

  // ── PASSO 1: Descriptografar via /decrypt-media ──
  const isPtt = audioMessage._type === 'ptt';
  const messagePayload = isPtt
    ? { pttMessage: audioMessage }
    : { audioMessage };

  logger.info({ url: wasenderConfig.DECRYPT_PATH, phoneNumber, sessionId }, 'Audio: solicitando descriptografia');

  const decryptResp = await fetch(wasenderConfig.DECRYPT_PATH, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${wasenderConfig.TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      data: { messages: { message: messagePayload } }
    }),
    signal: AbortSignal.timeout(20000)
  });

  const decryptRaw = await decryptResp.text();
  if (!decryptResp.ok) {
    throw new Error(
      `WASenderAPI /decrypt-media HTTP ${decryptResp.status}: ${decryptRaw.substring(0, 200)}`
    );
  }

  const decryptData = JSON.parse(decryptRaw);
  const publicUrl =
    decryptData?.publicUrl || decryptData?.data?.publicUrl || decryptData?.url;

  if (!publicUrl) {
    throw new Error(
      `/decrypt-media não retornou publicUrl. Resposta: ${JSON.stringify(decryptData).substring(0, 200)}`
    );
  }

  // ── PASSO 2: Baixar OGG ──
  await downloadFile(publicUrl, audioPath, {});

  // ── PASSO 3: Transcrever com Whisper ──
  try {
    const start = Date.now();
    const file = await toFile(fs.createReadStream(audioPath), 'audio.ogg', {
      type: 'audio/ogg'
    });

    const transcription = await getOpenAI().audio.transcriptions.create({
      file,
      model: 'whisper-1',
      response_format: 'verbose_json',
      temperature: 0.2
    });

    const latency = Date.now() - start;
    const t = transcription as { text: string; language?: string };
    logger.info(
      { latency, language: t.language },
      'Audio: transcrição concluída'
    );

    return {
      text: t.text,
      language: t.language || 'unknown',
      confidence: 'high',
      transcriptionLatency: latency
    };
  } finally {
    if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
  }
}
