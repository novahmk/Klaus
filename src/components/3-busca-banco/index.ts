// src/components/3-busca-banco/index.ts
export { BuscadorBanco } from './searcher';
export { GeradorEmbeddings } from './embeddings';
export { CacheBusca } from './cache';
export { ValidadorResultados } from './validators';
export { QUERIES, INDICES_RECOMENDADOS } from './queries';
export {
  LIMITES_BUSCA,
  PESOS_SCORING,
  CACHE_TTL,
  TipoBusca,
  MAPEAMENTO_INTENCAO_TIPO
} from './constants';
export {
  BuscaBancoInput,
  BuscaBancoOutput,
  RespostaEncontrada,
  ContextoBusca,
  BaseConhecimento,
  ObjecaoPadrao,
  ObjecaoPersonalizada,
  ResultadoBusca,
  TipoResposta
} from './types';
