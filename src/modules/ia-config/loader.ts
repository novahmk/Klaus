/**
 * Loader de Configuração de IA
 * Klaus V2 - Módulo ia-config
 *
 * Responsabilidades:
 *  - Carregar as 6 tabelas cfg_ia_* do Supabase em paralelo
 *  - Cache em memória com TTL configurável (padrão 5 minutos)
 *  - Fallback automático por tabela: se uma falhar, usa valor padrão
 *  - Timeout de 5 segundos por query
 *  - Logs detalhados para debug
 */

import { getSupabaseClient } from '../../lib/supabase';
import { MemoryCache } from '../../lib/cache';
import { logger } from '../../components/shared/logger';
import {
  ConfigIA,
  CfgIaParametros,
  CfgIaValidacao,
  CfgIaTomVoz,
  CfgIaRegras,
  CfgIaDisparos,
  CfgIaAprendizado
} from './types';
import {
  buildDefaultConfigIA,
  DEFAULT_PARAMETROS,
  DEFAULT_VALIDACAO,
  DEFAULT_TOM_VOZ,
  DEFAULT_REGRAS,
  DEFAULT_DISPAROS,
  DEFAULT_APRENDIZADO
} from './defaults';

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

const IA_CONFIG_CACHE_TTL_MS = parseInt(
  process.env.IA_CONFIG_CACHE_TTL_MS || '300000', // 5 minutos
  10
);

const iaConfigCache = new MemoryCache(IA_CONFIG_CACHE_TTL_MS);

const CACHE_KEY = (clienteId: string) => `ia-config:${clienteId}`;

// ---------------------------------------------------------------------------
// Helpers de query com timeout individual por tabela
// ---------------------------------------------------------------------------

const QUERY_TIMEOUT_MS = 5000;

async function queryTabela<T>(
  clienteId: string,
  tabela: string
): Promise<T | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const resultado = await Promise.race([
      client.from(tabela).select('*').eq('cliente_id', clienteId).single(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Timeout ao consultar ${tabela}`)),
          QUERY_TIMEOUT_MS
        )
      )
    ]);

    const { data, error } = resultado as { data: T | null; error: { message: string } | null };

    if (error) {
      logger.warn(
        { clienteId, tabela, erro: error.message },
        'ia-config: falha ao carregar tabela, usando padrão'
      );
      return null;
    }

    return data;
  } catch (err) {
    logger.warn(
      { clienteId, tabela, erro: (err as Error).message },
      'ia-config: timeout ou erro ao carregar tabela, usando padrão'
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// Carregamento principal
// ---------------------------------------------------------------------------

/**
 * Carrega as 6 tabelas cfg_ia_* do Supabase em paralelo.
 * Se uma tabela falhar, usa o valor padrão para aquela seção.
 * Retorna null apenas se o Supabase estiver completamente indisponível.
 */
export async function loadConfigFromSupabase(
  clienteId: string
): Promise<ConfigIA | null> {
  const client = getSupabaseClient();
  if (!client) {
    logger.warn(
      { clienteId },
      'ia-config: Supabase indisponível, usando fallback completo'
    );
    return null;
  }

  logger.debug({ clienteId }, 'ia-config: carregando configurações do Supabase');

  const [
    parametrosRaw,
    validacaoRaw,
    tomVozRaw,
    regrasRaw,
    disparosRaw,
    aprendizadoRaw
  ] = await Promise.all([
    queryTabela<CfgIaParametros>(clienteId, 'cfg_ia_parametros'),
    queryTabela<CfgIaValidacao>(clienteId, 'cfg_ia_validacao'),
    queryTabela<CfgIaTomVoz>(clienteId, 'cfg_ia_tom_voz'),
    queryTabela<CfgIaRegras>(clienteId, 'cfg_ia_regras'),
    queryTabela<CfgIaDisparos>(clienteId, 'cfg_ia_disparos'),
    queryTabela<CfgIaAprendizado>(clienteId, 'cfg_ia_aprendizado')
  ]);

  // Mescla resultado com defaults por tabela
  const parametros: CfgIaParametros = parametrosRaw
    ? { ...DEFAULT_PARAMETROS, ...parametrosRaw, cliente_id: clienteId }
    : { cliente_id: clienteId, ...DEFAULT_PARAMETROS };

  const validacao: CfgIaValidacao = validacaoRaw
    ? { ...DEFAULT_VALIDACAO, ...validacaoRaw, cliente_id: clienteId }
    : { cliente_id: clienteId, ...DEFAULT_VALIDACAO };

  const tom_voz: CfgIaTomVoz = tomVozRaw
    ? { ...DEFAULT_TOM_VOZ, ...tomVozRaw, cliente_id: clienteId }
    : { cliente_id: clienteId, ...DEFAULT_TOM_VOZ };

  const regras: CfgIaRegras = regrasRaw
    ? { ...DEFAULT_REGRAS, ...regrasRaw, cliente_id: clienteId }
    : { cliente_id: clienteId, ...DEFAULT_REGRAS };

  const disparos: CfgIaDisparos = disparosRaw
    ? { ...DEFAULT_DISPAROS, ...disparosRaw, cliente_id: clienteId }
    : { cliente_id: clienteId, ...DEFAULT_DISPAROS };

  const aprendizado: CfgIaAprendizado = aprendizadoRaw
    ? { ...DEFAULT_APRENDIZADO, ...aprendizadoRaw, cliente_id: clienteId }
    : { cliente_id: clienteId, ...DEFAULT_APRENDIZADO };

  const tabelasCarregadas = [
    parametrosRaw,
    validacaoRaw,
    tomVozRaw,
    regrasRaw,
    disparosRaw,
    aprendizadoRaw
  ].filter(Boolean).length;

  logger.info(
    { clienteId, tabelasCarregadas, totalTabelas: 6 },
    'ia-config: configurações carregadas do Supabase'
  );

  return {
    cliente_id: clienteId,
    parametros,
    validacao,
    tom_voz,
    regras,
    disparos,
    aprendizado,
    carregado_em: new Date().toISOString(),
    origem: 'supabase'
  };
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Retorna ConfigIA para o cliente, com cache e fallback automático.
 *
 * Fluxo:
 *  1. Verifica cache em memória (TTL padrão 5 min)
 *  2. Tenta carregar do Supabase (timeout 5s por tabela)
 *  3. Se Supabase indisponível, retorna valores padrão seguros
 */
export async function obterConfigIA(clienteId: string): Promise<ConfigIA> {
  const cacheKey = CACHE_KEY(clienteId);

  // 1. Cache hit
  const cached = iaConfigCache.get<ConfigIA>(cacheKey);
  if (cached) {
    logger.debug({ clienteId }, 'ia-config: retornado do cache');
    return cached;
  }

  // 2. Supabase
  try {
    const config = await loadConfigFromSupabase(clienteId);

    if (config) {
      iaConfigCache.set(cacheKey, config);
      logger.info({ clienteId, origem: 'supabase' }, 'ia-config: config cacheada');
      return config;
    }
  } catch (err) {
    logger.error(
      { clienteId, erro: (err as Error).message },
      'ia-config: erro inesperado ao carregar do Supabase'
    );
  }

  // 3. Fallback
  logger.warn(
    { clienteId },
    'ia-config: usando valores padrão (fallback)'
  );
  const fallback = buildDefaultConfigIA(clienteId);
  // Cacheia o fallback por um TTL menor (1 minuto) para tentar novamente em breve
  iaConfigCache.set(cacheKey, fallback, 60_000);
  return fallback;
}

/**
 * Invalida o cache de ConfigIA para um cliente específico.
 * Útil após atualização de configuração no dashboard.
 */
export function invalidarCacheConfigIA(clienteId: string): void {
  iaConfigCache.delete(CACHE_KEY(clienteId));
  logger.info({ clienteId }, 'ia-config: cache invalidado');
}

/**
 * Limpa todo o cache de ConfigIA.
 */
export function limparCacheConfigIA(): void {
  iaConfigCache.clear();
  logger.info('ia-config: cache completo limpo');
}
