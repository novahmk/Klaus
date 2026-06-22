import { logger } from '../../components/shared/logger';
import { getGlobalCache } from '../../lib/cache';
import {
  ConfigIACompleta,
  ConfigIAParametros,
  ConfigIAValidacao,
  ConfigIATomVoz,
  ConfigIARegras
} from './ia-config-types';
import {
  getDefaultConfigIA,
  validarConfigCompleta,
  validarConfigParametros
} from './ia-config-defaults';

const CACHE_KEY_CONFIG_IA = (clienteId: string) => `config_ia:${clienteId}`;

async function carregarConfigIADoSupabase(
  clienteId: string
): Promise<ConfigIACompleta | null> {
  try {
    const { getSupabaseClient } = await import('../../lib/supabase');
    const supabase = getSupabaseClient();

    if (!supabase) {
      logger.warn({ clienteId }, 'ConfigIALoader: Supabase não disponível');
      return null;
    }

    const parametrosResult = await supabase
      .from('cfg_ia_parametros')
      .select('*')
      .eq('cliente_id', clienteId)
      .single();

    if (parametrosResult.error) {
      logger.warn({ clienteId, erro: parametrosResult.error.message }, 'ConfigIALoader: erro ao carregar parametros');
      return null;
    }

    const parametros = parametrosResult.data as ConfigIAParametros;
    const errosParametros = validarConfigParametros(parametros);
    if (errosParametros.length > 0) {
      logger.warn({ clienteId, erros: errosParametros }, 'ConfigIALoader: parâmetros inválidos');
      return null;
    }

    const validacaoResult = await supabase
      .from('cfg_ia_validacao')
      .select('*')
      .eq('cliente_id', clienteId)
      .single();

    const validacao = validacaoResult.data as ConfigIAValidacao || {
      cliente_id: clienteId,
      penalidade_tamanho_minimo: -30,
      penalidade_tamanho_maximo: -30,
      penalidade_sem_cta: -10,
      penalidade_tom_negativo: -20,
      palavras_bloqueadas: [],
      palavras_obrigatorias: []
    };

    const tomVozResult = await supabase
      .from('cfg_ia_tom_voz')
      .select('*')
      .eq('cliente_id', clienteId)
      .eq('ativo', true);

    const tom_voz = (tomVozResult.data || []) as ConfigIATomVoz[];

    const regrasResult = await supabase
      .from('cfg_ia_regras')
      .select('*')
      .eq('cliente_id', clienteId)
      .eq('ativo', true);

    const regras = (regrasResult.data || []) as ConfigIARegras[];

    const config: ConfigIACompleta = {
      parametros,
      validacao,
      tom_voz,
      regras,
      ultima_atualizacao: new Date().toISOString(),
      versao: new Date(parametros.atualizado_em || new Date()).getTime()
    };

    const errosCompletos = validarConfigCompleta(config);
    if (errosCompletos.length > 0) {
      logger.warn({ clienteId, erros: errosCompletos }, 'ConfigIALoader: config inválida');
      return null;
    }

    logger.info({ clienteId }, 'ConfigIALoader: config carregada com sucesso');
    return config;
  } catch (erro) {
    logger.error({ clienteId, erro: (erro as Error).message }, 'ConfigIALoader: erro ao carregar config');
    return null;
  }
}

export async function obterConfigIA(clienteId: string): Promise<ConfigIACompleta> {
  const cacheKey = CACHE_KEY_CONFIG_IA(clienteId);
  const cached = getGlobalCache().get<ConfigIACompleta>(cacheKey);
  if (cached) {
    logger.debug({ clienteId }, 'ConfigIALoader: config do cache');
    return cached;
  }

  const config = await carregarConfigIADoSupabase(clienteId);

  if (config) {
    const ttl = config.parametros.cache_ttl_config_ms / 1000;
    getGlobalCache().set(cacheKey, config, ttl);
    logger.info({ clienteId }, 'ConfigIALoader: config cacheada');
    return config;
  }

  logger.warn({ clienteId }, 'ConfigIALoader: usando config padrão (Supabase indisponível)');
  const defaultConfig = getDefaultConfigIA(clienteId);
  getGlobalCache().set(cacheKey, defaultConfig, 60);
  return defaultConfig;
}

export function limparCacheConfigIA(clienteId?: string): void {
  if (clienteId) {
    const cacheKey = CACHE_KEY_CONFIG_IA(clienteId);
    getGlobalCache().delete(cacheKey);
    logger.info({ clienteId }, 'ConfigIALoader: cache limpo');
  } else {
    getGlobalCache().clear();
    logger.info('ConfigIALoader: todos os caches limpos');
  }
}

export async function iniciarConfigIALoader(): Promise<void> {
  if (process.env.CONFIG_LOADER_ENABLED !== 'true') {
    logger.info('ConfigIALoader: desabilitado');
    return;
  }

  const clienteId = process.env.DEFAULT_CLIENTE_ID || 'default';
  logger.info({ clienteId }, 'ConfigIALoader: iniciando');

  await obterConfigIA(clienteId);

  const refreshIntervalMs = parseInt(process.env.CONFIG_CACHE_TTL_MS || '300000', 10);
  const refreshHandle = setInterval(async () => {
    logger.debug({ clienteId }, 'ConfigIALoader: refresh periódico');
    limparCacheConfigIA(clienteId);
    await obterConfigIA(clienteId);
  }, refreshIntervalMs);

  refreshHandle.unref();
  logger.info({ clienteId, refreshMs: refreshIntervalMs }, 'ConfigIALoader: refresh periódico iniciado');
}
