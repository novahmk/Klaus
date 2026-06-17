// src/components/4-ranking-objecoes/component.ts
import { Pool } from 'pg';
import { RankerPerguntas } from './ranker';
import { RankingInput, RankingOutput, Pergunta } from './types';

export class ComponenteRanking {
  constructor(
    private db: Pool,
    private cache: unknown
  ) {}

  async executar(input: RankingInput): Promise<RankingOutput> {
    const scores: Pergunta[] = input.perguntasCandidatas.map((p) => {
      // Simulação de busca de métricas e cálculo
      const score = RankerPerguntas.calcularScoreFinal(0.8, 0.7, 0.9, 1.0);
      return { ...p, score };
    });

    const vencedora = scores.sort(
      (a, b) => (b.score || 0) - (a.score || 0)
    )[0];

    return {
      perguntaSelecionada: vencedora,
      score: vencedora.score || 0,
      motivo:
        'Maior alinhamento com o cargo e histórico de conversão positivo.'
    };
  }
}
