/**
 * Sprint 8: Regras de Conversa Dinâmicas
 * Carrega regras do Supabase (tabela `cfg_regras_conversa`) e avalia a
 * primeira regra cuja condição corresponda ao contexto atual do lead.
 *
 * Segue o mesmo padrão do config-loader (Sprint 1/7): cache em memória
 * com TTL, fallback seguro (nunca lança, nunca bloqueia o fluxo principal).
 */

import { getSupabaseClient, querySupabaseWithTimeout } from '../../lib/supabase';
import { getGlobalCache } from '../../lib/cache';
import { logger } from '../../components/shared/logger';
import { avaliarCondicao } from './evaluator';
import {
  ContextoAvaliacaoRegra,
  RegraConversa,
  ResultadoRegra
} from './types';

const CACHE_KEY_REGRAS = (clienteId: string) => `regras_conversa:${clienteId}`;

interface RegraConversaRow {
  id: string;
  cliente_id: string;
  nome: string;
  condicao_campo: string;
  condicao_operador: string;
  condicao_valor: string;
  acao: string;
  score_impacto: number;
  ordem: number;
  ativo: boolean;
}

function mapearLinha(row: RegraConversaRow): RegraConversa {
  // condicao_valor é armazenado como texto; se for numérico, converte.
  const valorNumerico = Number(row.condicao_valor);
  const valor =
    row.condicao_valor !== '' && !Number.isNaN(valorNumerico)
      ? valorNumerico
      : row.condicao_valor;

  return {
    id: row.id,
    clienteId: row.cliente_id,
    nome: row.nome,
    condicao: {
      campo: row.condicao_campo as RegraConversa['condicao']['campo'],
      operador: row.condicao_operador as RegraConversa['condicao']['operador'],
      valor
    },
    acao: row.acao,
    scoreImpacto: row.score_impacto ?? 0,
    ordem: row.ordem ?? 0,
    ativo: row.ativo
  };
}

/**
 * Carrega as regras ativas de um cliente do Supabase, ordenadas por `ordem`.
 * Nunca lança — em qualquer falha retorna array vazio (equivalente a
 * "nenhuma regra configurada").
 */
async function carregarRegrasDoSupabase(
  clienteId: string
): Promise<RegraConversa[]> {
  const client = getSupabaseClient();
  if (!client) {
    logger.warn({ clienteId }, 'RegrasConversa: Supabase não disponível');
    return [];
  }

  try {
    const result = await querySupabaseWithTimeout(async (supabase) => {
      const { data, error } = await supabase
        .from('cfg_regras_conversa')
        .select('*')
        .eq('cliente_id', clienteId)
        .eq('ativo', true)
        .order('ordem', { ascending: true });

      if (error || !data) {
        logger.warn(
          { clienteId, erro: error?.message },
          'RegrasConversa: falha ao carregar (usando lista vazia)'
        );
        return [];
      }

      return (data as RegraConversaRow[]).map(mapearLinha);
    }, 5000);

    return result ?? [];
  } catch (err) {
    logger.error(
      { clienteId, erro: (err as Error).message },
      'RegrasConversa: erro na carga'
    );
    return [];
  }
}

/**
 * Obtém as regras do cache ou do Supabase.
 */
export async function obterRegrasConversa(
  clienteId: string
): Promise<RegraConversa[]> {
  const cacheKey = CACHE_KEY_REGRAS(clienteId);
  const cached = getGlobalCache().get<RegraConversa[]>(cacheKey);

  if (cached) {
    logger.debug({ clienteId }, 'RegrasConversa: retornado do cache');
    return cached;
  }

  const regras = await carregarRegrasDoSupabase(clienteId);
  // Cacheia mesmo lista vazia, para evitar bater no Supabase a cada mensagem.
  getGlobalCache().set(cacheKey, regras);

  return regras;
}

/**
 * Avalia uma lista já carregada de regras (ordem crescente) contra o
 * contexto e retorna a primeira que corresponder, ou `null`.
 * Função pura — não depende de rede/cache, fácil de testar.
 */
export function avaliarRegrasContra(
  regras: RegraConversa[],
  contexto: ContextoAvaliacaoRegra
): ResultadoRegra | null {
  for (const regra of regras) {
    if (avaliarCondicao(regra.condicao, contexto)) {
      return {
        regra: regra.nome,
        acao: regra.acao,
        scoreImpacto: regra.scoreImpacto,
        ordem: regra.ordem
      };
    }
  }

  return null;
}

/**
 * Carrega as regras do cliente (cache/Supabase) e avalia contra o contexto.
 * Nunca lança — em qualquer falha de carga, retorna `null` (nenhuma ação).
 */
export async function avaliarRegras(
  clienteId: string,
  contexto: ContextoAvaliacaoRegra
): Promise<ResultadoRegra | null> {
  try {
    const regras = await obterRegrasConversa(clienteId);
    return avaliarRegrasContra(regras, contexto);
  } catch (err) {
    logger.warn(
      { clienteId, erro: (err as Error).message },
      'RegrasConversa: falha ao avaliar regras'
    );
    return null;
  }
}
