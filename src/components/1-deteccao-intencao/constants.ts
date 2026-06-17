/**
 * Constantes do Componente de Detecção de Intenção
 * Klaus V2 - Componente 1
 */

import { Intencao } from './types';

/**
 * Palavras-chave para fallback por intenção
 */
export const FALLBACK_KEYWORDS: Record<Intencao, RegExp> = {
  [Intencao.QUER_AGENDAR]: /\b(agendar|marcar|agend|agenda|reservar|horário|hora|quando|qual dia|qual horário|agende|marca)\b/gi,
  
  [Intencao.QUER_MAIS_INFO]: /\b(mais informações?|mais detalhes|como funciona|explica|explicar|saber mais|detalhes|informações?|brochura|documentação|falar mais|explique)\b/gi,
  
  [Intencao.TEM_OBJECAO]: /\b(mas|porém|entretanto|no entanto|contudo|já temos|já usamos|muito caro|caro demais|não temos|já existe|preço|valor|custo|impossível|não é possível)\b/gi,
  
  [Intencao.DEMONSTRA_INTERESSE]: /(interessante|interessado|interesse|legal|bacana|top|excelente|perfeito|ótimo|otimo|bom|gostei|adorei|muito bom|boa solução|faz sentido|entendi|parece bom|legal|massa|show|genial|bravo|amei|incrível|impressionante|maravilhoso|fantastico|fantastico|legal|sensacional|magnífico|magnifico)/gi,
  
  [Intencao.NAO_INTERESSADO]: /\b(não tenho interesse|não interessado|sem interesse|não vai|não é para mim|não vou|rejeitar|rejeita|chega|basta|pare|parar|sair|não preciso|desinteressado|desistir)\b/gi,
  
  [Intencao.NAO_RESPONDEU]: /^\s*$|^\.{3}$|^ok$|^sim$|^não$|^tá$|^tá bom$/gi
};

/**
 * Mapeamento de confiança por origem
 */
export const CONFIDENCE_MULTIPLIERS = {
  gpt: 0.95,
  fallback: 0.70,
  cache: 0.85
};

/**
 * Intervalo de confiança aceitável (0-100)
 */
export const CONFIDENCE_RANGE = {
  MIN: 0,
  MAX: 100
};

/**
 * TTL do cache em segundos
 */
export const CACHE_DEFAULT_TTL = 3600; // 1 hora

/**
 * Modelo GPT a usar
 */
export const GPT_MODEL = 'gpt-4-turbo-preview';

/**
 * Temperatura para respostas do GPT
 */
export const GPT_TEMPERATURE = 0.3;

/**
 * Máximo de tokens para resposta
 */
export const GPT_MAX_TOKENS = 500;
