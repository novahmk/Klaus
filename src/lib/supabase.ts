/**
 * Sprint 1: Cliente Supabase Singleton
 * Wrapper do Supabase JS client com tratamento de timeout e erro não-bloqueante.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../components/shared/logger';

let supabaseClient: SupabaseClient | null = null;
let initError: Error | null = null;

/**
 * Retorna cliente Supabase singleton.
 * Se URL ou KEY não estão configuradas, retorna null (fallback seguro).
 * Se inicialização falhou, retorna null e loga erro.
 */
export function getSupabaseClient(): SupabaseClient | null {
  // Já foi inicializado
  if (supabaseClient) return supabaseClient;

  // Houve erro na inicialização anterior
  if (initError) return null;

  const url = process.env.SUPABASE_URL || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || '';

  // Configs não disponíveis
  if (!url || !anonKey) {
    logger.warn(
      { supabaseUrl: !!url, supabaseAnonKey: !!anonKey },
      'Supabase: credenciais não configuradas (SUPABASE_ENABLED deve estar false)'
    );
    return null;
  }

  try {
    supabaseClient = createClient(url, anonKey, {
      auth: {
        persistSession: false // Não persiste em browser (ambiente server)
      },
      global: {
        headers: {
          'X-Klaus-Integration': 'sprint-1-config-loader'
        }
      }
    });

    logger.info('Supabase client inicializado com sucesso');
    return supabaseClient;
  } catch (err) {
    initError = err as Error;
    logger.error(
      { erro: initError.message },
      'Supabase client: falha na inicialização'
    );
    return null;
  }
}

/**
 * Retorna cliente service-role (se SERVICE_KEY está configurada).
 * Usa permissões elevadas; ideal para operações administrativas.
 */
export function getSupabaseServiceClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || '';

  if (!url || !serviceKey) {
    logger.warn('Supabase service client: credenciais não configuradas');
    return null;
  }

  try {
    return createClient(url, serviceKey, {
      auth: {
        persistSession: false
      },
      global: {
        headers: {
          'X-Klaus-Integration': 'sprint-1-service'
        }
      }
    });
  } catch (err) {
    logger.error(
      { erro: (err as Error).message },
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
