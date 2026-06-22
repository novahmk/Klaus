/**
 * Valores padrão seguros para configurações de IA.
 * Usados como fallback quando o Supabase está indisponível ou
 * quando uma tabela/cliente não é encontrado.
 */

import {
  ConfigIA,
  ConfigIAParametros,
  ConfigIAValidacao,
  ConfigIATomVoz,
  ConfigIARegras,
  ConfigIADisparos,
  ConfigIAAprendizado
} from './types';

export const DEFAULT_PARAMETROS: ConfigIAParametros = {
  max_tokens: 200,
  temperature: 0.4,
  model: 'gpt-4o-mini'
};

export const DEFAULT_VALIDACAO: ConfigIAValidacao = {
  min_length: 150,
  max_length: 500,
  min_score: 70,
  max_retries: 3
};

export const DEFAULT_TOM_VOZ: ConfigIATomVoz = {
  tom_geral: 'profissional',
  tom_executivo:
    'Foco em ROI, visão estratégica e resultados de alto nível. Linguagem direta.',
  tom_tecnico:
    'Foco em especificações, integração e performance. Linguagem precisa.',
  tom_suporte:
    'Foco em facilidade de uso, implementação e dia a dia. Linguagem prática.'
};

export const DEFAULT_REGRAS: ConfigIARegras = {
  regras: [
    'Não invente dados. Use apenas a Base de Conhecimento.',
    'Seja empático mas focado no fechamento.',
    'Responda em no máximo 2 a 3 frases curtas, sem listas e sem quebras de parágrafo.',
    'Seja direto: nada de introduções longas ou repetições.'
  ],
  palavras_chave_bloqueadas: ['infelizmente'],
  palavras_chave_obrigatorias: []
};

export const DEFAULT_DISPAROS: ConfigIADisparos = {
  intervalo_min_segundos: 3600,
  intervalo_max_segundos: 7200,
  limite_diario: 50
};

export const DEFAULT_APRENDIZADO: ConfigIAAprendizado = {
  ativo: false,
  metricas_habilitadas: false
};

/**
 * Retorna uma ConfigIA completa com todos os valores padrão.
 */
export function getDefaultConfigIA(clienteId = 'default'): ConfigIA {
  return {
    cliente_id: clienteId,
    parametros: { ...DEFAULT_PARAMETROS },
    validacao: { ...DEFAULT_VALIDACAO },
    tom_voz: { ...DEFAULT_TOM_VOZ },
    regras: {
      regras: [...DEFAULT_REGRAS.regras],
      palavras_chave_bloqueadas: [...DEFAULT_REGRAS.palavras_chave_bloqueadas],
      palavras_chave_obrigatorias: [...DEFAULT_REGRAS.palavras_chave_obrigatorias]
    },
    disparos: { ...DEFAULT_DISPAROS },
    aprendizado: { ...DEFAULT_APRENDIZADO },
    ultima_atualizacao: new Date().toISOString()
  };
}
