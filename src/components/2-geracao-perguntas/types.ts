/**
 * Tipos e Interfaces - Componente 2: Gerador de Perguntas
 * Klaus V2 - Componente 2
 */

import { Intencao } from '../1-deteccao-intencao';

/**
 * Camadas de geração de perguntas
 */
export enum CamadaPergunta {
  NECESSIDADE = 1,
  OBJECAO = 2,
  CONFIRMACAO = 3
}

/**
 * Mensagem no histórico
 */
export interface Mensagem {
  papel: 'lead' | 'sistema';
  conteudo: string;
  timestamp: Date;
}

/**
 * Entrada para o gerador de perguntas
 */
export interface GeradorPerguntasInput {
  tema: string;
  historico: Mensagem[];
  intencao: Intencao;
  clienteId: string;
  baseConhecimento?: Record<string, unknown>;
  perguntasJaFeitas?: string[];
}

/**
 * Saída do gerador de perguntas
 */
export interface GeradorPerguntasOutput {
  pergunta: string;
  contextoEsperado: string;
  camada: 1 | 2 | 3;
  timestamp: Date;
  origem: 'gpt' | 'template';
}

/**
 * Template de pergunta
 */
export interface TemplatoPergunta {
  pergunta: string;
  contextoEsperado: string;
  camada: CamadaPergunta;
  intencoes?: Intencao[]; // Se vazio, aplica a todas
  palavrasChave?: string[]; // Temas associados
}

/**
 * Configuração do gerador
 */
export interface GeradorConfig {
  redisUrl?: string;
  openaiApiKey?: string;
  enableCache?: boolean;
  enableFallback?: boolean;
  enableGpt?: boolean;
  cacheExpireSec?: number;
  maxSimilaridade?: number; // Máximo 70%
}

/**
 * Resultado de validação de pergunta
 */
export interface ResultadoValidacaoPergunta {
  valido: boolean;
  erros: string[];
}

/**
 * Resultado de análise de similaridade
 */
export interface ResultadoSimilaridade {
  similaridade: number; // 0-100%
  perguntaSimilar?: string;
}
