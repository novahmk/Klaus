/**
 * Cliente OpenAI - Integração compartilhada
 * Klaus V2
 *
 * Wrapper fino sobre o pacote oficial `openai` (v4) expondo os métodos
 * utilizados pelos componentes (atualmente: geração de embeddings).
 */

import OpenAI from 'openai';

export interface OpenAIEmbeddingsParams {
  model: string;
  input: string | string[];
}

export interface OpenAIEmbeddingItem {
  embedding: number[];
  index: number;
}

export interface OpenAIEmbeddingsResponse {
  data: OpenAIEmbeddingItem[];
}

export class OpenAIClient {
  private client: OpenAI;

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY
    });
  }

  /**
   * Gera embeddings para um texto ou lista de textos.
   */
  async embeddings(
    params: OpenAIEmbeddingsParams
  ): Promise<OpenAIEmbeddingsResponse> {
    const resposta = await this.client.embeddings.create({
      model: params.model,
      input: params.input
    });

    return {
      data: resposta.data.map((item) => ({
        embedding: item.embedding,
        index: item.index
      }))
    };
  }
}
