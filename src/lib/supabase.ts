/**
 * Sprint 1: Cliente Supabase Singleton
 * Wrapper do Supabase JS client com tratamento de timeout e erro não-bloqueante.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../components/shared/logger';

let supabaseClient: SupabaseClient | null = null;
let initError: Error | null = null;

interface CredencialResolvida {
  /** Valor da variável de ambiente (string vazia se nenhuma estiver definida). */
  valor: string;
  /** Nome da env var efetivamente usada (null se nenhuma tinha valor). */
  origem: string | null;
}

/**
 * Resolve uma credencial aceitando o nome "legado" (formato JWT, ex.:
 * SUPABASE_ANON_KEY) e o novo formato de chaves do Supabase (ex.:
 * SUPABASE_PUBLISHABLE_KEY / SUPABASE_SECRET_KEY, prefixo sb_publishable_/
 * sb_secret_). O nome legado tem prioridade se ambos estiverem definidos.
 */
function resolverCredencial(
  nomeLegado: string,
  nomeNovo: string
): CredencialResolvida {
  // .trim() remove \n/espaços invisíveis colados junto da chave no painel do Railway,
  // que fazem o createClient lançar "Invalid header value" na construção.
  const legado = (process.env[nomeLegado] || '').trim();
  if (legado) return { valor: legado, origem: nomeLegado };

  const novo = (process.env[nomeNovo] || '').trim();
  if (novo) return { valor: novo, origem: nomeNovo };

  return { valor: '', origem: null };
}

/**
 * Retorna cliente Supabase singleton.
 * Se URL ou KEY não estão configuradas, retorna null (fallback seguro).
 * Se inicialização falhou, retorna null e loga erro.
 *
 * Aceita tanto SUPABASE_ANON_KEY (formato JWT legado) quanto
 * SUPABASE_PUBLISHABLE_KEY (novo formato sb_publishable_...).
 */
export function getSupabaseClient(): SupabaseClient | null {
  // Já foi inicializado
  if (supabaseClient) return supabaseClient;

  // Houve erro na inicialização anterior
  if (initError) return null;

  const url = (process.env.SUPABASE_URL || '').trim();
  const chave = resolverCredencial('SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY');

  // Configs não disponíveis
  if (!url || !chave.valor) {
    logger.warn(
      {
        SUPABASE_URL_definida: !!process.env.SUPABASE_URL,
        SUPABASE_URL_vazia: process.env.SUPABASE_URL !== undefined && !url,
        SUPABASE_ANON_KEY_definida: !!process.env.SUPABASE_ANON_KEY,
        SUPABASE_PUBLISHABLE_KEY_definida: !!process.env.SUPABASE_PUBLISHABLE_KEY,
        variavelKeyEncontrada: chave.origem
      },
      'Supabase: credenciais não configuradas (SUPABASE_ENABLED deve estar false)'
    );
    return null;
  }

  try {
    supabaseClient = createClient(url, chave.valor, {
      auth: {
        persistSession: false // Não persiste em browser (ambiente server)
      },
      global: {
        headers: {
          'X-Klaus-Integration': 'sprint-1-config-loader'
        }
      }
    });

    logger.info(
      { variavelKeyUsada: chave.origem },
      'Supabase client inicializado com sucesso'
    );
    return supabaseClient;
  } catch (err) {
    initError = err as Error;
    logger.error(
      {
        erro: initError.message,
        erroNome: initError.name,
        variavelKeyUsada: chave.origem,
        urlDefinida: !!url
      },
      'Supabase client: falha na inicialização'
    );
    return null;
  }
}

/**
 * Retorna cliente service-role (se SERVICE_KEY está configurada).
 * Usa permissões elevadas; ideal para operações administrativas.
 *
 * Aceita tanto SUPABASE_SERVICE_KEY (formato JWT legado) quanto
 * SUPABASE_SECRET_KEY (novo formato sb_secret_...).
 */
export function getSupabaseServiceClient(): SupabaseClient | null {
  const url = (process.env.SUPABASE_URL || '').trim();
  const chave = resolverCredencial('SUPABASE_SERVICE_KEY', 'SUPABASE_SECRET_KEY');

  if (!url || !chave.valor) {
    logger.warn(
      {
        SUPABASE_URL_definida: !!process.env.SUPABASE_URL,
        SUPABASE_URL_vazia: process.env.SUPABASE_URL !== undefined && !url,
        SUPABASE_SERVICE_KEY_definida: !!process.env.SUPABASE_SERVICE_KEY,
        SUPABASE_SECRET_KEY_definida: !!process.env.SUPABASE_SECRET_KEY,
        variavelKeyEncontrada: chave.origem
      },
      'Supabase service client: credenciais não configuradas'
    );
    return null;
  }

  try {
    const client = createClient(url, chave.valor, {
      auth: {
        persistSession: false
      },
      global: {
        headers: {
          'X-Klaus-Integration': 'sprint-1-service'
        }
      }
    });
    logger.info(
      { variavelKeyUsada: chave.origem },
      'Supabase service client inicializado com sucesso'
    );
    return client;
  } catch (err) {
    const erro = err as Error;
    logger.error(
      {
        erro: erro.message,
        erroNome: erro.name,
        variavelKeyUsada: chave.origem,
        urlDefinida: !!url
      },
      'Supabase service client: falha na inicialização'
    );
    return null;
  }
}

/**
 * Query auxiliar com timeout e fallback.
 * Usa Promise.race para enforçar timeout máximo.
 */
export async function querySupabaseWithTimeout<T>(
  fn: (client: SupabaseClient) => Promise<T>,
  timeoutMs = 5000
): Promise<T | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const result = await Promise.race([
      fn(client),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Supabase timeout')), timeoutMs)
      )
    ]);
    return result;
  } catch (err) {
    logger.warn(
      { erro: (err as Error).message, timeoutMs },
      'Supabase query: falha ou timeout'
    );
    return null;
  }
}
