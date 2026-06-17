// src/components/7-orquestracao/constants.ts

export const ORCHESTRATOR_CONFIG = {
  TIMEOUTS: {
    DETECCAO: 3000,
    BUSCA: 5000,
    GERACAO: 8000,
    QUALIFICACAO: 2000,
    GLOBAL: 20000
  },
  RETRY: {
    MAX_TENTATIVAS: 3,
    BACKOFF_INICIAL: 500 // ms
  },
  CIRCUIT_BREAKER: {
    FAILURE_THRESHOLD: 5,
    RESET_TIMEOUT: 60000 // 1 minuto
  },
  CACHE: {
    TTL_PADRAO: 3600, // 1 hora
    PREFIXO: 'klaus:v2:orch:'
  }
};
