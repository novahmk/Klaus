// src/components/5-geracao-resposta/component.ts
import { OpenAI } from 'openai';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { PromptBuilder } from './prompts';
import { ValidadorResposta } from './validator';
import { GeracaoInput } from './types';

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
    const cacheKey = `gen:${input.tipoObjecao}:${input.contextoLead.cargo}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const prompt = PromptBuilder.build(input);

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'system', content: prompt }],
      temperature: 0.7
    });

    const resposta = completion.choices[0].message.content ?? '';
    const score = ValidadorResposta.validar(resposta, input);

    const result = { resposta, confianca: score / 100 };

    await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 3600);

    return result;
  }
}
