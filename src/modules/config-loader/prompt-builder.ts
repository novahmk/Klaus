/**
 * Sprint 1: Prompt Builder
 * Constrói system prompt dinâmico a partir das configurações do dashboard.
 */

import { getGlobalCache } from '../../lib/cache';
import { logger } from '../../components/shared/logger';
import { DashboardConfig } from './types';

const CACHE_KEY_PROMPT = (clienteId: string) => `prompt:${clienteId}`;

/**
 * Instrução de formato/brevidade anexada SEMPRE ao final do system prompt,
 * independente da configuração do dashboard. Garante que o modo dinâmico
 * também limite o tamanho da resposta (o modo fixo já fazia isso), evitando
 * respostas longas cortadas no meio pelo validador.
 */
const REGRA_FORMATO =
  'FORMATO DE RESPOSTA: Responda em 2-3 frases curtas, máximo 150 caracteres. ' +
  'Seja direto e natural, como uma mensagem de WhatsApp. ' +
  'Não use listas ou formatação. Uma única mensagem, sem múltiplos parágrafos.';

/**
 * Constrói system prompt a partir de configurações do dashboard.
 * Fallback: se config não disponível, retorna prompt vazio/minimalista.
 */
export function construirSystemPrompt(config: DashboardConfig | null): string {
  if (!config) {
    logger.debug('PromptBuilder: config null, retornando prompt minimalista');
    return `Você é um assistente de vendas profissional. 
Seja consultivo, empático e ofereça valor antes de pedir.
Sempre pergunte antes de descartar oportunidades.

${REGRA_FORMATO}`;
  }

  const linhas: string[] = [];

  // Persona
  if (config.persona?.nome) {
    linhas.push(`Você é ${config.persona.nome}.`);
    if (config.persona.descricao) {
      linhas.push(`${config.persona.descricao}`);
    }
    if (config.persona.cargo_alvo) {
      linhas.push(
        `Você está conversando com um ${config.persona.cargo_alvo}. Adapte seus argumentos e exemplos para este perfil.`
      );
    }
  }

  // Objetivo
  if (config.objetivo?.objetivo_curto) {
    linhas.push(`\nObjetivo imediato: ${config.objetivo.objetivo_curto}`);
  }
  if (config.objetivo?.descricao) {
    linhas.push(`\nObjetivo: ${config.objetivo.descricao}`);
  }
  if (config.objetivo?.objetivo_longo) {
    linhas.push(`\nContexto completo do objetivo: ${config.objetivo.objetivo_longo}`);
  }

  // Contexto
  if (config.contexto?.contexto_empresa) {
    linhas.push(`\nSomos uma ${config.contexto.contexto_empresa}`);
  }
  if (config.contexto?.contexto_industria) {
    linhas.push(`Atuamos na indústria de ${config.contexto.contexto_industria}`);
  }

  // Tom de voz
  if (
    config.tom_voz?.tom_geral &&
    config.tom_voz?.tom_executivo &&
    config.tom_voz?.tom_tecnico &&
    config.tom_voz?.tom_suporte
  ) {
    linhas.push(
      `\nSe o lead demonstrar perfil executivo, adote tom ${config.tom_voz.tom_executivo}. ` +
        `Se técnico, ${config.tom_voz.tom_tecnico}. ` +
        `Se suporte, ${config.tom_voz.tom_suporte}. ` +
        `Caso contrário, ${config.tom_voz.tom_geral}.`
    );
  } else if (config.tom_voz?.tom_geral) {
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

  if (
    config.regras?.palavras_chave_bloqueadas &&
    config.regras.palavras_chave_bloqueadas.length > 0
  ) {
    linhas.push(
      `NUNCA use estas palavras: ${config.regras.palavras_chave_bloqueadas.join(', ')}`
    );
  }

  linhas.push(`\n${REGRA_FORMATO}`);

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
