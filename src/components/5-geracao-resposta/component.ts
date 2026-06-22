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
import { obterConfigIA } from '../../modules/config-loader/ia-config-loader';
import { logger } from '../shared/logger';

export class ComponenteGeracao {
  constructor(
    private openai: OpenAI,
    private db: Pool,
    private redis: Redis
  ) {}

  async executar(input: GeracaoInput): Promise<{
    resposta: string;
    confianca: number;
    config_versao?: number;
  }> {
    const cacheKey = `gen:${input.tipoObjecao}:${input.contextoLead.cargo}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // Load IA config dynamically from Supabase (with automatic fallback to defaults)
    let config;
    try {
      config = await obterConfigIA(input.clienteId);
    } catch (erro) {
      logger.warn(
        { leadId: input.leadId, erro: (erro as Error).message },
        'IA: falha ao carregar config dinâmica, usando defaults'
      );
    }

    const promptPadrao = PromptBuilder.build(input, config);
    const promptDinamicoHabilitado = process.env.DYNAMIC_PROMPT_ENABLED === 'true';
    const promptDinamico = promptDinamicoHabilitado
      ? obterSystemPrompt(input.clienteId)
      : '';
    const prompt = promptDinamico || promptPadrao;

    const temperatura = config?.parametros.temperatura ?? GERACAO_CONFIG.TEMPERATURE;
    const maxTokens = config?.parametros.max_tokens ?? GERACAO_CONFIG.MAX_TOKENS;
    const modelo = config?.parametros.modelo_chat ?? getOpenAIConfig().CHAT_MODEL;
    const cacheTtl = config?.parametros.cache_ttl_resposta_segundos ?? 3600;

    const inicio = Date.now();
    let completion;
    try {
      completion = await this.openai.chat.completions.create({
        model: modelo,
        messages: [{ role: 'system', content: prompt }],
        temperature: temperatura,
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

    const resposta = ValidadorResposta.truncar(
      completion.choices[0].message.content ?? '',
      config
    );
    const score = ValidadorResposta.validar(resposta, input, config);

    // Log de baixo custo: metadados de observabilidade, sem conteúdo.
    logger.info(
      {
        leadId: input.leadId,
        correlationId: input.leadId,
        latenciaMs: Date.now() - inicio,
        model: completion.model,
        respostaVazia: resposta.length === 0,
        tamanhoResposta: resposta.length,
        configVersao: config?.versao
      },
      'IA: resposta gerada'
    );

    const result = {
      resposta,
      confianca: score / 100,
      config_versao: config?.versao
    };

    await this.redis.set(cacheKey, JSON.stringify(result), 'EX', cacheTtl);

    return result;
  }
}
