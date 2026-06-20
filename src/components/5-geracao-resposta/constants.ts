// src/components/5-geracao-resposta/constants.ts

export const CRITERIOS_VALIDACAO = {
  MIN_SCORE: 70,
  MAX_RETRIES: 3,
  MIN_LENGTH: 150,
  MAX_LENGTH: 500
};

/** Parâmetros de geração para conter respostas longas/verbosas. */
export const GERACAO_CONFIG = {
  // ~500–600 caracteres: trava física de tamanho na chamada da IA.
  MAX_TOKENS: 200,
  // Menor temperatura = respostas mais diretas e menos prolixas.
  TEMPERATURE: 0.4
};

export const INSTRUCOES_TOM = {
  EXECUTIVO:
    'Foco em ROI, visão estratégica e resultados de alto nível. Linguagem direta.',
  TECNICO:
    'Foco em especificações, integração e performance. Linguagem precisa.',
  OPERACIONAL:
    'Foco em facilidade de uso, implementação e dia a dia. Linguagem prática.'
};
