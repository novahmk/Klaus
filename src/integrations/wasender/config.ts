// src/integrations/wasender/config.ts
import 'dotenv/config';

const BASE_URL = (
  process.env.WASENDERAPI_BASE_URL || 'https://www.wasenderapi.com/api'
).replace(/\/$/, '');

export const wasenderConfig = {
  PORT: Number(process.env.PORT) || 8080,
  TOKEN:
    process.env.WASENDERAPI_TOKEN || process.env.API_ACCESS_TOKEN || '',
  BASE_URL,
  SEND_PATH: `${BASE_URL}/send-message`,
  DECRYPT_PATH: `${BASE_URL}/decrypt-media`,
  WEBHOOK_SECRET:
    process.env.WASENDERAPI_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || '',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  /** 'queue' (default) enfileira no Comp. 8; 'direct' chama o Orquestrador. */
  PROCESSING_MODE: (process.env.PROCESSING_MODE || 'queue') as 'queue' | 'direct'
};
