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
import { logger } from '../../shared/logger';

export class ComponenteGeracao {
  constructor(
    private openai: OpenAI,
    private db: Pool,
    private redis: Redis
  ) {}

  async executar(input: GeracaoInput): Promise<{
    resposta: string;
    confianca: number;
  }> {
    const hashMensagem = Buffer.from(input.objecao ?? '')
      .toString('base64')
      .slice(0, 16);
    const cacheKey = `gen:${input.tipoObjecao}:${input.contextoLead.cargo}:${hashMensagem}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      logger.info({ cacheKey, hit: true }, 'Comp5: cache hit');
      return JSON.parse(cached);
    }
    logger.info({ cacheKey, hit: false }, 'Comp5: cache miss, chamando LLM');

    const promptPadrao = PromptBuilder.build(input);
    const promptDinamicoHabilitado = process.env.DYNAMIC_PROMPT_ENABLED === 'true';
    const promptDinamico = promptDinamicoHabilitado
      ? obterSystemPrompt(input.clienteId)
      : '';
    const prompt = promptDinamico || promptPadrao;

    // O system prompt (fixo ou dinâmico) define persona/regras. A mensagem do
    // lead precisa ir como role 'user' — caso contrário, em modo dinâmico o
    // prompt-builder não inclui o texto do lead e a IA responde "no vazio".
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: prompt }
    ];
    if (input.objecao && input.objecao.trim().length > 0) {
      messages.push({ role: 'user', content: input.objecao });
    }

    const inicio = Date.now();
    let completion;
    try {
      completion = await this.openai.chat.completions.create({
        model: getOpenAIConfig().CHAT_MODEL,
        messages,
        temperature: GERACAO_CONFIG.TEMPERATURE,
        max_tokens: GERACAO_CONFIG.MAX_TOKENS
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
      completion.choices[0].message.content ?? ''
    );
    const score = ValidadorResposta.validar(resposta, input);

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

    await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 300);

    return result;
  }
}
