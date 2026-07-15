/**
 * Sprint 1: Config Loader
 * Carrega configurações do dashboard do Supabase e as armazena em cache.
 * Refresh automático a cada CONFIG_CACHE_TTL_MS.
 */

import { getSupabaseClient, querySupabaseWithTimeout } from '../../lib/supabase';
import { getGlobalCache } from '../../lib/cache';
import { logger } from '../../components/shared/logger';
import { DashboardConfig, ConfigScoring } from './types';
import { cachePrompt, construirSystemPrompt } from './prompt-builder';

const CACHE_KEY_CONFIG = (clienteId: string) => `config:${clienteId}`;
const CACHE_KEY_SCORING = (clienteId: string) => `scoring:${clienteId}`;

/**
 * Carrega configuração completa do dashboard do Supabase.
 *
 * Cada uma das 6 tabelas é consultada com `.maybeSingle()` (não lança erro
 * quando não há linha para o `cliente_id`) e tratada de forma INDEPENDENTE:
 * se uma tabela falhar (erro de permissão, tabela inexistente, timeout),
 * as demais que carregaram com sucesso continuam compondo a config. Só
 * retorna `null` (fallback total, prompt minimalista) se TODAS as 6
 * falharem.
 */
async function loadConfigFromSupabase(
  clienteId: string
): Promise<DashboardConfig | null> {
  const client = getSupabaseClient();
  if (!client) {
    logger.warn({ clienteId }, 'ConfigLoader: Supabase não disponível');
    return null;
  }

  try {
    const result = await querySupabaseWithTimeout(async (supabase) => {
      const [persona, objetivo, abordagens, contexto, tom_voz, regras] =
        await Promise.all([
          supabase.from('cfg_ia_persona').select('*').eq('cliente_id', clienteId).maybeSingle(),
          supabase.from('cfg_ia_objetivo').select('*').eq('cliente_id', clienteId).maybeSingle(),
          supabase.from('cfg_ia_abordagens').select('*').eq('cliente_id', clienteId).maybeSingle(),
          supabase.from('cfg_ia_contexto').select('*').eq('cliente_id', clienteId).maybeSingle(),
          supabase.from('cfg_ia_tom_voz').select('*').eq('cliente_id', clienteId).maybeSingle(),
          supabase.from('cfg_ia_regras').select('*').eq('cliente_id', clienteId).maybeSingle()
        ]);

      const tabelas = [
        { nome: 'cfg_ia_persona', resultado: persona },
        { nome: 'cfg_ia_objetivo', resultado: objetivo },
        { nome: 'cfg_ia_abordagens', resultado: abordagens },
        { nome: 'cfg_ia_contexto', resultado: contexto },
        { nome: 'cfg_ia_tom_voz', resultado: tom_voz },
        { nome: 'cfg_ia_regras', resultado: regras }
      ];

      let tabelasOk = 0;
      let tabelasFalha = 0;

      for (const { nome, resultado: r } of tabelas) {
        if (r.error) {
          tabelasFalha++;
          logger.warn(
            { clienteId, tabela: nome, erro: r.error.message, codigo: r.error.code },
            'ConfigLoader: falha ao carregar tabela'
          );
        } else {
          tabelasOk++;
          logger.debug(
            { clienteId, tabela: nome, campos: r.data ? Object.keys(r.data).length : 0 },
            'ConfigLoader: tabela carregada com sucesso'
          );
        }
      }

      logger.info(
        { clienteId, tabelasOk, tabelasFalha, totalTabelas: tabelas.length },
        'ConfigLoader: resumo da carga'
      );

      // Todas as tabelas falharam: fallback total (prompt minimalista).
      if (tabelasOk === 0) {
        return null;
      }

      return {
        cliente_id: clienteId,
        persona: persona.data || {},
        objetivo: objetivo.data || {},
        abordagens: abordagens.data || {},
        contexto: contexto.data || {},
        tom_voz: tom_voz.data || {},
        regras: regras.data || { regras: [], palavras_chave_bloqueadas: [], palavras_chave_obrigatorias: [] },
        ultima_atualizacao: new Date().toISOString()
      };
    }, 5000);

    return result;
  } catch (err) {
    logger.error(
      { clienteId, erro: (err as Error).message },
      'ConfigLoader: erro na carga'
    );
    return null;
  }
}

/**
 * Obtém configuração do cache ou do Supabase.
 */
export async function obterConfig(
  clienteId: string
): Promise<DashboardConfig | null> {
  // Tenta cache primeiro
  const cacheKey = CACHE_KEY_CONFIG(clienteId);
  const cached = getGlobalCache().get<DashboardConfig>(cacheKey);

  if (cached) {
    logger.debug({ clienteId }, 'Config: retornado do cache');
    return cached;
  }

  // Carrega do Supabase
  const config = await loadConfigFromSupabase(clienteId);
  if (config) {
    getGlobalCache().set(cacheKey, config);
    const systemPrompt = construirSystemPrompt(config);
    cachePrompt(clienteId, systemPrompt);
    logger.info({ clienteId }, 'Config: carregado do Supabase e cacheado');
  }

  return config;
}

/**
 * Sprint 7: Carrega configuração dinâmica de scoring/qualificação do Supabase.
 * Isolada de `loadConfigFromSupabase` — falha aqui nunca afeta as demais
 * configurações (persona/objetivo/tom/regras).
 */
async function loadConfigScoringFromSupabase(
  clienteId: string
): Promise<ConfigScoring | null> {
  const client = getSupabaseClient();
  if (!client) {
    logger.warn({ clienteId }, 'ConfigScoring: Supabase não disponível');
    return null;
  }

  try {
    const result = await querySupabaseWithTimeout(async (supabase) => {
      const { data, error } = await supabase
        .from('config_scoring')
        .select('*')
        .eq('cliente_id', clienteId)
        .single();

      if (error || !data) {
        logger.warn(
          { clienteId, erro: error?.message },
          'ConfigScoring: falha ao carregar (usando defaults)'
        );
        return null;
      }

      return {
        cliente_id: clienteId,
        pesos: {
          intencao: Number(data.peso_intencao),
          engajamento: Number(data.peso_engajamento),
          contexto: Number(data.peso_contexto),
          historico: Number(data.peso_historico)
        },
        scores_intencao: (data.scores_intencao as Record<string, number>) || {},
        threshold_handoff: Number(data.threshold_handoff),
        threshold_notificacao: Number(data.threshold_notificacao),
        atualizado_em: new Date().toISOString()
      } as ConfigScoring;
    }, 5000);

    return result;
  } catch (err) {
    logger.error(
      { clienteId, erro: (err as Error).message },
      'ConfigScoring: erro na carga'
    );
    return null;
  }
}

/**
 * Sprint 7: Obtém configuração de scoring do cache ou do Supabase.
 * Retorna `null` se indisponível — o chamador deve usar os defaults
 * hardcoded (PESOS/SCORES_INTENCAO do Componente 6) nesse caso.
 */
export async function obterConfigScoring(
  clienteId: string
): Promise<ConfigScoring | null> {
  const cacheKey = CACHE_KEY_SCORING(clienteId);
  const cached = getGlobalCache().get<ConfigScoring>(cacheKey);

  if (cached) {
    logger.debug({ clienteId }, 'ConfigScoring: retornado do cache');
    return cached;
  }

  const config = await loadConfigScoringFromSupabase(clienteId);
  if (config) {
    getGlobalCache().set(cacheKey, config);
    logger.info({ clienteId }, 'ConfigScoring: carregado do Supabase e cacheado');
  }

  return config;
}

/**
 * Inicializa o loader: carrega config inicial e agenda refresh.
 */
export async function iniciarConfigLoader(): Promise<void> {
  if (process.env.CONFIG_LOADER_ENABLED !== 'true') {
    logger.info('ConfigLoader: desabilitado (CONFIG_LOADER_ENABLED=false)');
    return;
  }

  const clienteId = process.env.DEFAULT_CLIENTE_ID || 'default';

  logger.info({ clienteId }, 'ConfigLoader: iniciando carga inicial');

  // Carga inicial
  const config = await obterConfig(clienteId);
  if (config) {
    logger.info({ clienteId }, 'ConfigLoader: config carregada com sucesso');
  } else {
    logger.warn(
      { clienteId },
      'ConfigLoader: falha na carga inicial (continuando sem config dinâmica)'
    );
  }

  // Refresh periódico
  const refreshIntervalMs = parseInt(
    process.env.CONFIG_CACHE_TTL_MS || '300000',
    10
  );

  const refreshHandle = setInterval(async () => {
    logger.debug({ clienteId }, 'ConfigLoader: refresh periódico');
    await obterConfig(clienteId);
  }, refreshIntervalMs);

  // Permite que processo encerre sem esperar interval
  refreshHandle.unref();

  logger.info(
    { clienteId, refreshMs: refreshIntervalMs },
    'ConfigLoader: refresh periódico iniciado'
  );
}

/**
 * Limpa cache de config.
 */
export function limparConfigCache(): void {
  getGlobalCache().clear();
  logger.info('ConfigLoader: cache limpo');
}
