/**
 * Sprint 1: Prompt Builder
 * Constrói system prompt dinâmico a partir das configurações do dashboard.
 */

import { getGlobalCache } from '../../lib/cache';
import { logger } from '../../components/shared/logger';
import { DashboardConfig } from './types';

const CACHE_KEY_PROMPT = (clienteId: string) => `prompt:${clienteId}`;

/**
 * Constrói system prompt a partir de configurações do dashboard.
 * Fallback: se config não disponível, retorna prompt vazio/minimalista.
 */
export function construirSystemPrompt(config: DashboardConfig | null): string {
  if (!config) {
    logger.debug('PromptBuilder: config null, retornando prompt minimalista');
    return `Você é um assistente de vendas profissional. 
Seja consultivo, empático e ofereça valor antes de pedir.
Sempre pergunte antes de descartar oportunidades.`;
  }

  const linhas: string[] = [];

  // Persona
  if (config.persona?.nome) {
    linhas.push(`Você é ${config.persona.nome}.`);
    if (config.persona.descricao) {
      linhas.push(`${config.persona.descricao}`);
    }
  }

  // Objetivo
  if (config.objetivo?.descricao) {
    linhas.push(`\nObjetivo: ${config.objetivo.descricao}`);
  }

  // Contexto
  if (config.contexto?.contexto_empresa) {
    linhas.push(`\nSomos uma ${config.contexto.contexto_empresa}`);
  }
  if (config.contexto?.contexto_industria) {
    linhas.push(`Atuamos na indústria de ${config.contexto.contexto_industria}`);
  }

  // Tom de voz
  if (config.tom_voz?.tom_geral) {
    linhas.push(
      `\nComunique-se de forma ${config.tom_voz.tom_geral} mas humanizada.`
    );
  }

  // Abordagens
  if (
    config.abordagens?.abordagens &&
    config.abordagens.abordagens.length > 0
  ) {
    linhas.push(
      `\nAbordagens recomendadas: ${config.abordagens.abordagens.join(', ')}`
    );
  }
  if (config.abordagens?.evitar && config.abordagens.evitar.length > 0) {
    linhas.push(`\nEvite: ${config.abordagens.evitar.join(', ')}`);
  }

  // Regras
  if (config.regras?.regras && config.regras.regras.length > 0) {
    linhas.push(`\nRegras importantes:`);
    config.regras.regras.forEach((regra) => {
      linhas.push(`  - ${regra}`);
    });
  }

  if (
    config.regras?.palavras_chave_obrigatorias &&
    config.regras.palavras_chave_obrigatorias.length > 0
  ) {
    linhas.push(
      `Sempre mencione: ${config.regras.palavras_chave_obrigatorias.join(', ')}`
    );
  }

  const prompt = linhas.join('\n');
  logger.debug(
    { clienteId: config.cliente_id, linhas: linhas.length },
    'PromptBuilder: prompt construído'
  );

  return prompt;
}

/**
 * Obtém system prompt cacheado.
 * Se cache expirou, retorna prompt minimalista (não bloqueia chamada à IA).
 */
export function obterSystemPrompt(clienteId?: string): string {
  const cliente = clienteId || process.env.DEFAULT_CLIENTE_ID || 'default';
  const cacheKey = CACHE_KEY_PROMPT(cliente);

  const cached = getGlobalCache().get<string>(cacheKey);
  if (cached) {
    logger.debug({ clienteId: cliente }, 'PromptBuilder: prompt do cache');
    return cached;
  }

  logger.debug(
    { clienteId: cliente },
    'PromptBuilder: cache expirado, usando prompt default'
  );

  // Fallback minimalista: não bloqueia a resposta
  return `Você é um assistente de vendas consultivo e empático. 
Ofereça valor antes de qualquer pedido. Sempre pergunte antes de descartar oportunidades.
Seja direto, profissional e focado em resolver o problema do cliente.`;
}

/**
 * Armazena prompt no cache.
 */
export function cachePrompt(clienteId: string, prompt: string): void {
  const cacheKey = CACHE_KEY_PROMPT(clienteId);
  getGlobalCache().set(cacheKey, prompt);
}
