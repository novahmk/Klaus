// src/integrations/wasender/client.ts
import axios from 'axios';
import { wasenderConfig } from './config';
import { logger } from '../../components/shared/logger';

/**
 * Normaliza número de telefone para somente dígitos.
 */
export function normalizarTelefone(phone: string): string {
  return String(phone || '')
    .replace(/^whatsapp:/, '')
    .replace(/@s\.whatsapp\.net$/, '')
    .replace(/@lid$/, '')
    .replace(/[^0-9]/g, '')
    .trim();
}

/**
 * Envia mensagem de texto via WASenderAPI.
 */
export async function enviarMensagem(
  to: string,
  text: string
): Promise<unknown> {
  if (!wasenderConfig.TOKEN) {
    throw new Error('WASENDERAPI_TOKEN não configurado — mensagem não enviada.');
  }

  const phone = normalizarTelefone(to);
  logger.info(
    { phone, preview: text.substring(0, 80) },
    'WASender: enviando mensagem'
  );

  try {
    const response = await axios.post(
      wasenderConfig.SEND_PATH,
      { to: phone, text },
      {
        headers: {
          Authorization: `Bearer ${wasenderConfig.TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );
    logger.info({ status: response.status }, 'WASender: mensagem enviada');
    return response.data;
  } catch (err) {
    const e = err as { response?: { status?: number; data?: unknown }; message?: string };
    logger.error(
      {
        status: e.response?.status || 'sem response',
        body: JSON.stringify(e.response?.data || e.message)
      },
      'WASender: falha ao enviar'
    );
    throw err;
  }
}
