// src/components/6-qualificacao/constants.ts

export const PESOS = {
  INTENCAO: 0.4,
  ENGAJAMENTO: 0.3,
  CONTEXTO: 0.2,
  HISTORICO: 0.1
};

export const SCORES_INTENCAO: Record<string, number> = {
  QUER_AGENDAR: 100,
  DEMONSTRA_INTERESSE: 80,
  QUER_MAIS_INFO: 60,
  TEM_OBJECAO: 40,
  NAO_RESPONDEU: 20,
  NAO_INTERESSADO: 0
};
