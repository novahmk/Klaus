/**
 * Cliente OpenAI - Integração compartilhada
 * Klaus V2
 *
 * Wrapper fino sobre o pacote oficial `openai` (v4) expondo os métodos
 * utilizados pelos componentes (atualmente: geração de embeddings).
 */

import OpenAI from 'openai';
import { assertOpenAIConfigured, getOpenAIConfig } from './config';

export interface OpenAIEmbeddingsParams {
  model?: string;
  input: string | string[];
}

export interface OpenAIEmbeddingItem {
  embedding: number[];
  index: number;
}

export interface OpenAIEmbeddingsResponse {
  data: OpenAIEmbeddingItem[];
}

export interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAIChatParams {
  messages: OpenAIChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export class OpenAIClient {
  private client: OpenAI;

  constructor(apiKey?: string) {
    const config = getOpenAIConfig();
    const resolvedApiKey = assertOpenAIConfigured(apiKey || config.API_KEY);

    this.client = new OpenAI({
      apiKey: resolvedApiKey
    });
  }

  /**
   * Gera embeddings para um texto ou lista de textos.
   */
  async embeddings(
    params: OpenAIEmbeddingsParams
  ): Promise<OpenAIEmbeddingsResponse> {
    const config = getOpenAIConfig();
    const resposta = await this.client.embeddings.create({
      model: params.model || config.EMBEDDING_MODEL,
      input: params.input
    });

    return {
      data: resposta.data.map((item) => ({
        embedding: item.embedding,
        index: item.index
      }))
    };
  }

  /**
   * Gera uma resposta de chat e retorna o texto do primeiro choice.
   */
  async chat(params: OpenAIChatParams): Promise<string> {
    const config = getOpenAIConfig();
    const resposta = await this.client.chat.completions.create({
      model: params.model || config.CHAT_MODEL,
      messages: params.messages,
      temperature: params.temperature ?? config.TEMPERATURE,
      max_tokens: params.maxTokens
    });

    return resposta.choices[0]?.message?.content?.trim() ?? '';
  }
}
