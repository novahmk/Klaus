import 'dotenv/config';

export interface OpenAIConfig {
  API_KEY: string;
  EMBEDDING_MODEL: string;
  CHAT_MODEL: string;
  TEMPERATURE: number;
}

function parseTemperature(raw: string | undefined): number {
  const parsed = Number(raw);
  if (Number.isNaN(parsed)) return 0.7;
  if (parsed < 0) return 0;
  if (parsed > 2) return 2;
  return parsed;
}

export function getOpenAIConfig(): OpenAIConfig {
  return {
    API_KEY: process.env.OPENAI_API_KEY || '',
    EMBEDDING_MODEL: process.env.OPENAI_MODEL_EMBEDDING || 'text-embedding-3-small',
    CHAT_MODEL: process.env.OPENAI_MODEL_CHAT || 'gpt-4o-mini',
    TEMPERATURE: parseTemperature(process.env.OPENAI_TEMPERATURE)
  };
}

export function assertOpenAIConfigured(apiKey?: string): string {
  const resolved = (apiKey || '').trim();
  if (!resolved) {
    throw new Error('OPENAI_API_KEY não configurada. Defina a variável de ambiente para habilitar integração OpenAI.');
  }
  return resolved;
}
