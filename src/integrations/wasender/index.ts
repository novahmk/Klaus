// src/integrations/wasender/index.ts
export { wasenderConfig } from './config';
export { enviarMensagem, normalizarTelefone } from './client';
export {
  safeCompare,
  autenticarWebhook,
  createFallbackMessageId
} from './auth';
export {
  checarRateLimitTelefone,
  checarRateLimitIp
} from './rate-limit';
export { parsePayloadWASender } from './parser';
export type { PayloadParseado, AudioMessage } from './parser';
export {
  downloadFile,
  transcribeAudioViaWASender
} from './transcription';
export type { TranscricaoResult, TranscreverParams } from './transcription';
export {
  configurarProcessor,
  processarMensagem
} from './processor';
export { criarOrquestradorWasender } from './bootstrap';
export type {
  MensagemRecebida,
  OrquestradorLike,
  QueueManagerLike
} from './processor';
export { criarApp, iniciarServidor } from './webhook-server';
