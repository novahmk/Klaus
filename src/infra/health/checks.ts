import OpenAI from 'openai';
import { QueueManager } from '../../components/8-filas/queue-manager';
import { query } from '../database/pool';
import { wasenderConfig } from '../../integrations/wasender/config';
import { HealthCheck } from './types';

const openAiApiKey = process.env.OPENAI_API_KEY || '';

const openAiClient = openAiApiKey
  ? new OpenAI({ apiKey: openAiApiKey })
  : null;

export const pingChecks: HealthCheck[] = [
  {
    name: 'database',
    timeout: 4_000,
    fn: async () => {
      const result = await query<{ ok: number }>('SELECT 1 AS ok');
      if (!result.rows?.[0]?.ok) {
        throw new Error('Query de health não retornou OK');
      }
      return { detail: 'SELECT 1 OK' };
    }
  },
  {
    name: 'redis',
    timeout: 3_000,
    fn: async () => {
      if (wasenderConfig.PROCESSING_MODE !== 'queue') {
        return { skipped: true, detail: 'PROCESSING_MODE=direct' };
      }

      const pong = await QueueManager.getInstance().healthPing();
      if (pong !== 'PONG') {
        throw new Error(`Redis retornou: ${pong}`);
      }
      return { detail: 'PONG' };
    }
  },
  {
    name: 'ai-api',
    timeout: 8_000,
    fn: async () => {
      if (!openAiApiKey) {
        throw new Error('OPENAI_API_KEY não configurada');
      }
      if (openAiApiKey.length < 20) {
        throw new Error('OPENAI_API_KEY parece inválida');
      }
      return { detail: 'API key presente e válida' };
    }
  },
  {
    name: 'webhook-inbound',
    timeout: 5_000,
    fn: async () => {
      if (!wasenderConfig.TOKEN) {
        throw new Error('WASender token ausente');
      }
      if (!wasenderConfig.WEBHOOK_SECRET) {
        throw new Error('WASender webhook secret ausente');
      }
      return {
        detail: 'TOKEN e WEBHOOK_SECRET configurados'
      };
    }
  }
];

const openAiLiveCheck: HealthCheck = {
  name: 'openai-live',
  timeout: 8_000,
  fn: async () => {
    if (!openAiClient) {
      throw new Error('OPENAI_API_KEY não configurada');
    }

    const models = await openAiClient.models.list();
    const firstModel = models.data?.[0]?.id || 'unknown';
    return { detail: `models.list OK (${firstModel})` };
  }
};

export const fullChecks: HealthCheck[] = [...pingChecks, openAiLiveCheck];
