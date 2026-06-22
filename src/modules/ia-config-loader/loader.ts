/**
 * IA Config Loader
 * Carrega e cacheia configurações de IA do Supabase (tabelas cfg_ia_*).
 * Fallback automático para defaults quando Supabase está indisponível.
 */

import { getSupabaseClient, querySupabaseWithTimeout } from '../../lib/supabase';
import { getGlobalCache } from '../../lib/cache';
import { logger } from '../../components/shared/logger';
import { ConfigIA } from './types';
import { getDefaultConfigIA } from './defaults';

const CONFIG_CACHE_TTL_MS = parseInt(
  process.env.CONFIG_CACHE_TTL_MS || '300000',
  10
);

const CACHE_KEY_IA = (clienteId: string) => `ia-config:${clienteId}`;

/**
 * Carrega todas as configurações de IA do Supabase em paralelo.
 * Retorna null se qualquer query falhar ou timeout for atingido.
 */
export async function loadConfigFromSupabase(
  clienteId: string
): Promise<ConfigIA | null> {
  const client = getSupabaseClient();
  if (!client) {
    logger.warn({ clienteId }, 'IAConfigLoader: Supabase não disponível');
    return null;
  }

  try {
    const result = await querySupabaseWithTimeout(async (supabase) => {
      const [parametros, validacao, tom_voz, regras, disparos, aprendizado] =
        await Promise.all([
          supabase
            .from('cfg_ia_parametros')
            .select('*')
            .eq('cliente_id', clienteId)
            .single(),
          supabase
            .from('cfg_ia_validacao')
            .select('*')
            .eq('cliente_id', clienteId)
            .single(),
          supabase
            .from('cfg_ia_tom_voz')
            .select('*')
            .eq('cliente_id', clienteId)
            .single(),
          supabase
            .from('cfg_ia_regras')
            .select('*')
            .eq('cliente_id', clienteId)
            .single(),
          supabase
            .from('cfg_ia_disparos')
            .select('*')
            .eq('cliente_id', clienteId)
            .single(),
          supabase
            .from('cfg_ia_aprendizado')
            .select('*')
            .eq('cliente_id', clienteId)
            .single()
        ]);

      // Se qualquer query falhou, retorna null para acionar fallback
      if (
        parametros.error ||
        validacao.error ||
        tom_voz.error ||
        regras.error ||
        disparos.error ||
        aprendizado.error
      ) {
        logger.warn(
          {
            clienteId,
            erros: [
              parametros.error?.message,
              validacao.error?.message,
              tom_voz.error?.message,
              regras.error?.message,
              disparos.error?.message,
              aprendizado.error?.message
            ].filter(Boolean)
          },
          'IAConfigLoader: falha ao carregar config IA'
        );
        return null;
      }

      const defaults = getDefaultConfigIA(clienteId);

      return {
        cliente_id: clienteId,
        parametros: parametros.data || defaults.parametros,
        validacao: validacao.data || defaults.validacao,
        tom_voz: tom_voz.data || defaults.tom_voz,
        regras: regras.data || defaults.regras,
        disparos: disparos.data || defaults.disparos,
        aprendizado: aprendizado.data || defaults.aprendizado,
        ultima_atualizacao: new Date().toISOString()
      } satisfies ConfigIA;
    }, 5000);

    return result;
  } catch (err) {
    logger.error(
      { clienteId, erro: (err as Error).message },
      'IAConfigLoader: erro na carga'
    );
    return null;
  }
}

/**
 * Obtém ConfigIA para um cliente.
 * Ordem de prioridade: cache → Supabase → defaults.
 * Nunca lança exceção — sempre retorna uma ConfigIA válida.
 */
export async function obterConfigIA(clienteId: string): Promise<ConfigIA> {
  const cacheKey = CACHE_KEY_IA(clienteId);

  // 1. Tenta cache
  const cached = getGlobalCache().get<ConfigIA>(cacheKey);
  if (cached) {
    logger.debug({ clienteId }, 'IAConfigLoader: config retornada do cache');
    return cached;
  }

  // 2. Tenta Supabase
  const config = await loadConfigFromSupabase(clienteId);
  if (config) {
    getGlobalCache().set(cacheKey, config, CONFIG_CACHE_TTL_MS);
    logger.info({ clienteId }, 'IAConfigLoader: config carregada do Supabase');
    return config;
  }

  // 3. Fallback para defaults
  logger.warn(
    { clienteId },
    'IAConfigLoader: usando defaults (Supabase indisponível)'
  );
  const defaults = getDefaultConfigIA(clienteId);
  // Cacheia defaults por metade do TTL para tentar Supabase mais cedo
  getGlobalCache().set(cacheKey, defaults, Math.floor(CONFIG_CACHE_TTL_MS / 2));
  return defaults;
}

/**
 * Inicializa o IA Config Loader: carrega config inicial e agenda refresh.
 * Não-bloqueante. Desligável via CONFIG_LOADER_ENABLED=false.
 */
export async function iniciarIAConfigLoader(): Promise<void> {
  if (process.env.CONFIG_LOADER_ENABLED !== 'true') {
    logger.info(
      'IAConfigLoader: desabilitado (CONFIG_LOADER_ENABLED=false)'
    );
    return;
  }

  const clienteId = process.env.DEFAULT_CLIENTE_ID || 'default';

  logger.info({ clienteId }, 'IAConfigLoader: iniciando carga inicial');

  // Carga inicial (não-bloqueante)
  const config = await obterConfigIA(clienteId);
  if (config.cliente_id !== 'default' || clienteId === 'default') {
    logger.info({ clienteId }, 'IAConfigLoader: config IA carregada com sucesso');
  } else {
    logger.warn(
      { clienteId },
      'IAConfigLoader: usando defaults na carga inicial'
    );
  }

  // Refresh periódico
  const refreshHandle = setInterval(async () => {
    logger.debug({ clienteId }, 'IAConfigLoader: refresh periódico');
    // Invalida cache para forçar recarga
    getGlobalCache().delete(CACHE_KEY_IA(clienteId));
    await obterConfigIA(clienteId);
  }, CONFIG_CACHE_TTL_MS);

  // Permite que o processo encerre sem esperar o interval
  refreshHandle.unref();

  logger.info(
    { clienteId, refreshMs: CONFIG_CACHE_TTL_MS },
    'IAConfigLoader: refresh periódico iniciado'
  );
}
