// src/components/3-busca-banco/constants.ts
import { Intencao } from '../1-deteccao-intencao/types';
import { TipoResposta } from './types';

export const LIMITES_BUSCA = {
  MAX_RESULTADOS: 5,
  MIN_RELEVANCIA: 0.6,
  MIN_EFETIVIDADE: 0.3,
  TIMEOUT_BUSCA: 5000
};

export const PESOS_SCORING = {
  RELEVANCIA: 0.5,
  EFETIVIDADE: 0.3,
  RECENCIA: 0.2
};

export const CACHE_TTL = {
  BUSCA_PADRAO: 24 * 60 * 60,
  BUSCA_PERSONALIZADA: 7 * 24 * 60 * 60
};

export enum TipoBusca {
  PALAVRA_CHAVE = 'palavra_chave',
  SEMANTICA = 'semantica',
  HIBRIDA = 'hibrida'
}

export const MAPEAMENTO_INTENCAO_TIPO: Record<Intencao, TipoResposta[]> = {
  [Intencao.QUER_AGENDAR]: ['base_conhecimento', 'objecao_personalizada'],
  [Intencao.QUER_MAIS_INFO]: ['base_conhecimento'],
  [Intencao.TEM_OBJECAO]: ['objecao_padrao', 'objecao_personalizada'],
  [Intencao.DEMONSTRA_INTERESSE]: ['base_conhecimento'],
  [Intencao.NAO_RESPONDEU]: [],
  [Intencao.NAO_INTERESSADO]: ['objecao_padrao']
};
