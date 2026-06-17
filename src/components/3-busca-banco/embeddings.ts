// src/components/3-busca-banco/embeddings.ts
import { OpenAIClient } from '../../integrations/openai/client';

export class GeradorEmbeddings {
  constructor(private openaiClient: OpenAIClient) {}

  async gerar(texto: string): Promise<number[]> {
    try {
      const resposta = await this.openaiClient.embeddings({
        model: 'text-embedding-3-small',
        input: texto
      });
      return resposta.data[0].embedding;
    } catch (erro) {
      console.error(
        `[ERRO EMBEDDING] Falha ao gerar embedding: ${(erro as Error).message}`
      );
      throw new Error('Falha ao gerar embedding');
    }
  }

  async gerarBatch(textos: string[]): Promise<number[][]> {
    try {
      const resposta = await this.openaiClient.embeddings({
        model: 'text-embedding-3-small',
        input: textos
      });
      return resposta.data
        .sort((a, b) => a.index - b.index)
        .map((item) => item.embedding);
    } catch (erro) {
      console.error(
        `[ERRO EMBEDDING BATCH] Falha: ${(erro as Error).message}`
      );
      throw new Error('Falha ao gerar embeddings em batch');
    }
  }

  calcularSimilaridade(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings com tamanhos diferentes');
    }

    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      magnitude1 += embedding1[i] * embedding1[i];
      magnitude2 += embedding2[i] * embedding2[i];
    }

    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);

    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }

    return dotProduct / (magnitude1 * magnitude2);
  }
}
