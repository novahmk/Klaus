/**
 * Valores padrão seguros para fallback de ConfigIA
 * Klaus V2 - Módulo ia-config
 *
 * Usados quando o Supabase está indisponível ou quando uma tabela
 * específica falha ao carregar.  Todos os valores foram escolhidos
 * para comportamento conservador em produção.
 */

import {
  CfgIaParametros,
  CfgIaValidacao,
  CfgIaTomVoz,
  CfgIaRegras,
  CfgIaDisparos,
  CfgIaAprendizado,
  ConfigIA
} from './types';

export const DEFAULT_PARAMETROS: Omit<CfgIaParametros, 'cliente_id'> = {
  min_length: 5,
  max_length: 500,
  max_tokens: 500,
  temperature: 0.3,
  limite_frases: 3,
  tom_resposta: 'profissional'
};

export const DEFAULT_VALIDACAO: Omit<CfgIaValidacao, 'cliente_id'> = {
  regras_validacao: [],
  min_confianca: 0.7
};

export const DEFAULT_TOM_VOZ: Omit<CfgIaTomVoz, 'cliente_id'> = {
  tom_geral: 'profissional',
  tom_executivo: 'Foco em ROI, visão estratégica e resultados de alto nível. Linguagem direta.',
  tom_tecnico: 'Foco em especificações, integração e performance. Linguagem precisa.',
  tom_suporte: 'Foco em facilidade de uso, implementação e dia a dia. Linguagem prática.'
};

export const DEFAULT_REGRAS: Omit<CfgIaRegras, 'cliente_id'> = {
  regras: [],
  palavras_chave_bloqueadas: [],
  palavras_chave_obrigatorias: []
};

export const DEFAULT_DISPAROS: Omit<CfgIaDisparos, 'cliente_id'> = {
  intervalo_min_segundos: 3600,
  intervalo_max_segundos: 7200,
  limite_diario: 10
};

export const DEFAULT_APRENDIZADO: Omit<CfgIaAprendizado, 'cliente_id'> = {
  ativar_aprendizado: false,
  taxa_aprendizado: 0.1
};

/**
 * Constrói um ConfigIA completo com valores padrão para o cliente informado.
 */
export function buildDefaultConfigIA(clienteId: string): ConfigIA {
  return {
    cliente_id: clienteId,
    parametros: { cliente_id: clienteId, ...DEFAULT_PARAMETROS },
    validacao: { cliente_id: clienteId, ...DEFAULT_VALIDACAO },
    tom_voz: { cliente_id: clienteId, ...DEFAULT_TOM_VOZ },
    regras: { cliente_id: clienteId, ...DEFAULT_REGRAS },
    disparos: { cliente_id: clienteId, ...DEFAULT_DISPAROS },
    aprendizado: { cliente_id: clienteId, ...DEFAULT_APRENDIZADO },
    carregado_em: new Date().toISOString(),
    origem: 'fallback'
  };
}
