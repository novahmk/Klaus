// src/components/5-geracao-resposta/component.ts
import { OpenAI } from 'openai';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { PromptBuilder } from './prompts';
import { ValidadorResposta } from './validator';
import { GERACAO_CONFIG } from './constants';
import { GeracaoInput } from './types';
import { getOpenAIConfig } from '../../integrations/openai';
import { obterSystemPrompt } from '../../modules/config-loader/prompt-builder';
import { logger } from '../shared/logger';
import type { ConfigIA } from '../../modules/ia-config/types';

export class ComponenteGeracao {
  constructor(
    private openai: OpenAI,
    private db: Pool,
    private redis: Redis,
    /** Configuração dinâmica de IA por cliente (opcional; usa GERACAO_CONFIG como fallback) */
    private configIA?: ConfigIA
  ) {}

  async executar(input: GeracaoInput): Promise<{
    resposta: string;
    confianca: number;
  }> {
    const cacheKey = `gen:${input.tipoObjecao}:${input.contextoLead.cargo}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const promptPadrao = PromptBuilder.build(input);
    const promptDinamicoHabilitado = process.env.DYNAMIC_PROMPT_ENABLED === 'true';
    const promptDinamico = promptDinamicoHabilitado
      ? obterSystemPrompt(input.clienteId)
      : '';
    const prompt = promptDinamico || promptPadrao;

    // Parâmetros dinâmicos: usa ConfigIA se disponível, senão GERACAO_CONFIG (fallback)
    const temperature = this.configIA?.parametros.temperature ?? GERACAO_CONFIG.TEMPERATURE;
    const maxTokens = this.configIA?.parametros.max_tokens ?? GERACAO_CONFIG.MAX_TOKENS;

    const inicio = Date.now();
    let completion;
    try {
      completion = await this.openai.chat.completions.create({
        model: getOpenAIConfig().CHAT_MODEL,
        messages: [{ role: 'system', content: prompt }],
        temperature,
        max_tokens: maxTokens
      });
    } catch (erro) {
      // Log de baixo custo: apenas metadados, sem prompt/resposta.
      logger.error(
        {
          leadId: input.leadId,
          correlationId: input.leadId,
          latenciaMs: Date.now() - inicio,
          erro: (erro as Error).message
        },
        'IA: falha na chamada de chat'
      );
      throw erro;
    }

    // Limites dinâmicos: usa ConfigIA se disponível, senão CRITERIOS_VALIDACAO (fallback)
    const maxLength = this.configIA?.parametros.max_length;
    const minLength = this.configIA?.parametros.min_length;

    const resposta = ValidadorResposta.truncar(
      completion.choices[0].message.content ?? '',
      maxLength,
      minLength
    );
    const score = ValidadorResposta.validar(resposta, input, minLength, maxLength);

    // Log de baixo custo: metadados de observabilidade, sem conteúdo.
    logger.info(
      {
        leadId: input.leadId,
        correlationId: input.leadId,
        latenciaMs: Date.now() - inicio,
        model: completion.model,
        respostaVazia: resposta.length === 0,
        tamanhoResposta: resposta.length
      },
      'IA: resposta gerada'
    );

    const result = { resposta, confianca: score / 100 };

    await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 3600);

    return result;
  }
}
