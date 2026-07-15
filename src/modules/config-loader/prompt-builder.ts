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
 * Normaliza um valor vindo do Supabase para array de strings.
 *
 * Colunas que deveriam ser `text[]` às vezes chegam como `text` simples
 * (erro de schema/seed), o que quebra `.forEach()`/`.map()`/`.join()` no
 * restante do arquivo. Este helper garante que sempre teremos um array,
 * tentando separar por quebra de linha ou vírgula quando o valor vier
 * como string.
 */
function garantirArray(valor: unknown): string[] {
  if (Array.isArray(valor)) return valor;
  if (typeof valor === 'string') {
    if (valor.includes('\n')) {
      return valor
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    if (valor.includes(',')) {
      return valor
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return valor.trim() ? [valor.trim()] : [];
  }
  if (!valor) return [];
  return [valor as string];
}

/**
 * Constrói system prompt a partir de configurações do dashboard.
 * Fallback: se config não disponível, retorna prompt vazio/minimalista.
 */
export function construirSystemPrompt(config: DashboardConfig | null): string {
  if (!config) {
    const promptMinimalista = `Você é um assistente de vendas profissional. 
Seja consultivo, empático e ofereça valor antes de pedir.
Sempre pergunte antes de descartar oportunidades.

${REGRA_FORMATO}`;

    logger.info(
      {
        promptDinamicoAtivo: false,
        tamanhoPrompt: promptMinimalista.length,
        preview: promptMinimalista.slice(0, 200)
      },
      'PromptBuilder: config null, retornando prompt minimalista'
    );

    return promptMinimalista;
  }

  const linhas: string[] = [];

  // Persona
  if (config.persona?.nome) {
    linhas.push(`Você é ${config.persona.nome}.`);
    if (config.persona.descricao) {
      linhas.push(`${config.persona.descricao}`);
    }
  }

  // cargo_alvo migrou de persona para contexto (schema real)
  if (config.contexto?.cargo_alvo) {
    linhas.push(
      `Você está conversando com um ${config.contexto.cargo_alvo}. Adapte seus argumentos e exemplos para este perfil.`
    );
  }

  // Objetivo
  if (config.objetivo?.objetivo_curto) {
    linhas.push(`\nObjetivo imediato: ${config.objetivo.objetivo_curto}`);
  }
  // Sem coluna "descricao" no schema real: usa objetivo_longo como fallback.
  if (config.objetivo?.objetivo_longo) {
    linhas.push(`\nObjetivo: ${config.objetivo.objetivo_longo}`);
  }

  // Base de conhecimento (contexto) — truncada para não estourar tokens.
  if (config.contexto?.base_conhecimento) {
    const texto =
      typeof config.contexto.base_conhecimento === 'string'
        ? config.contexto.base_conhecimento
        : JSON.stringify(config.contexto.base_conhecimento);
    const truncado = texto.length > 1500 ? `${texto.slice(0, 1500)}...` : texto;
    if (texto.length > 1500) {
      logger.debug(
        { clienteId: config.cliente_id, tamanhoOriginal: texto.length },
        'PromptBuilder: base_conhecimento truncada'
      );
    }
    linhas.push(`\nBase de conhecimento: ${truncado}`);
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

  // Abordagens (3 textos fixos por etapa, schema real de cfg_ia_abordagens)
  if (config.abordagens?.abordagem_inicial) {
    linhas.push(`\nAbordagem inicial: ${config.abordagens.abordagem_inicial}`);
  }
  if (config.abordagens?.abordagem_objecao) {
    linhas.push(`Ao lidar com objeções: ${config.abordagens.abordagem_objecao}`);
  }
  if (config.abordagens?.abordagem_fechamento) {
    linhas.push(`Para fechar: ${config.abordagens.abordagem_fechamento}`);
  }

  // DEBUG TEMPORÁRIO: confirmar o tipo real vindo do Supabase para os campos
  // que quebravam com `.forEach is not a function` (coluna `text` em vez de
  // `text[]`). Remover após diagnóstico.
  console.log(
    '[DEBUG PROMPT] regras type:',
    typeof config.regras?.regras,
    'isArray:',
    Array.isArray(config.regras?.regras)
  );
  console.log(
    '[DEBUG PROMPT] regras value:',
    JSON.stringify(config.regras?.regras)?.substring(0, 200)
  );

  // Regras — normaliza para array antes de qualquer .forEach()/.map()/.join(),
  // pois a coluna pode chegar como string simples em vez de text[].
  const regrasArray = garantirArray(config.regras?.regras);
  if (regrasArray.length > 0) {
    linhas.push(`\nRegras importantes:`);
    regrasArray.forEach((regra) => {
      linhas.push(`  - ${regra}`);
    });
  }

  const obrigatoriasArray = garantirArray(config.regras?.palavras_chave_obrigatorias);
  if (obrigatoriasArray.length > 0) {
    linhas.push(`Sempre mencione: ${obrigatoriasArray.join(', ')}`);
  }

  // palavras_chave_bloqueadas existe tanto em `regras` quanto em `contexto`
  // no schema real — combina as duas listas sem duplicar, normalizando
  // cada uma antes de espalhar no Set.
  const bloqueadas = Array.from(
    new Set([
      ...garantirArray(config.regras?.palavras_chave_bloqueadas),
      ...garantirArray(config.contexto?.palavras_chave_bloqueadas)
    ])
  );
  if (bloqueadas.length > 0) {
    linhas.push(`NUNCA use estas palavras: ${bloqueadas.join(', ')}`);
  }

  linhas.push(`\n${REGRA_FORMATO}`);

  const prompt = linhas.join('\n');
  logger.info(
    {
      clienteId: config.cliente_id,
      promptDinamicoAtivo: true,
      tamanhoPrompt: prompt.length,
      preview: prompt.slice(0, 200)
    },
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
    logger.debug(
      { clienteId: cliente, promptDinamicoAtivo: true, tamanhoPrompt: cached.length },
      'PromptBuilder: prompt do cache'
    );
    return cached;
  }

  const fallback = `Você é um assistente de vendas consultivo e empático. 
Ofereça valor antes de qualquer pedido. Sempre pergunte antes de descartar oportunidades.
Seja direto, profissional e focado em resolver o problema do cliente.`;

  logger.warn(
    {
      clienteId: cliente,
      promptDinamicoAtivo: false,
      tamanhoPrompt: fallback.length
    },
    'PromptBuilder: FALLBACK GENÉRICO usado (cache expirado ou nunca populado)'
  );

  // Fallback minimalista: não bloqueia a resposta
  return fallback;
}

/**
 * Armazena prompt no cache.
 */
export function cachePrompt(clienteId: string, prompt: string): void {
  const cacheKey = CACHE_KEY_PROMPT(clienteId);
  getGlobalCache().set(cacheKey, prompt);
}
