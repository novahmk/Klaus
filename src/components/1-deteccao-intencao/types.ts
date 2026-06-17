/**
 * Tipos e Enums do Componente de Detecção de Intenção
 * Klaus V2 - Componente 1
 */

export enum Intencao {
  QUER_AGENDAR = 'QUER_AGENDAR',
  QUER_MAIS_INFO = 'QUER_MAIS_INFO',
  TEM_OBJECAO = 'TEM_OBJECAO',
  DEMONSTRA_INTERESSE = 'DEMONSTRA_INTERESSE',
  NAO_INTERESSADO = 'NAO_INTERESSADO',
  NAO_RESPONDEU = 'NAO_RESPONDEU'
}

/**
 * Resultado da detecção de intenção
 */
export interface DeteccaoIntencaoResult {
  intencao: Intencao;
  confianca: number; // 0-100
  motivo: string;
  timestamp: Date;
  origem: string; // 'gpt' | 'fallback' | 'cache'
}

/**
 * Entrada para o detector
 */
export interface DetectorInput {
  mensagem: string;
  historico?: MensagemHistorico[];
  contexto?: ContextoLead;
}

/**
 * Mensagem no histórico
 */
export interface MensagemHistorico {
  papel: 'lead' | 'sistema';
  conteudo: string;
  timestamp: Date;
}

/**
 * Contexto do lead
 */
export interface ContextoLead extends Record<string, unknown> {
  leadId?: string;
  empresa?: string;
  segmento?: string;
  faseFunil?: string;
  interacoesAnteriores?: number;
}

/**
 * Opções de configuração do detector
 */
export interface DetectorConfig {
  redisUrl?: string;
  openaiApiKey?: string;
  enableCache?: boolean;
  enableFallback?: boolean;
  enableGpt?: boolean;
  cacheExpireSec?: number;
}

/**
 * Resultado da análise por fallback
 */
export interface FallbackAnalysisResult {
  intencao: Intencao;
  confianca: number;
  motivo: string;
  regra: string;
}
