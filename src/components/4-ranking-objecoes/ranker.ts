// src/components/4-ranking-objecoes/ranker.ts
import { PESOS_RANKING } from './constants';

export class RankerPerguntas {
  /**
   * Calcula o score final via média ponderada:
   * Score = (R * 0.4) + (E * 0.3) + (C * 0.2) + (Rec * 0.1)
   */
  static calcularScoreFinal(
    relevancia: number,
    efetividade: number,
    contexto: number,
    recencia: number
  ): number {
    return (
      relevancia * PESOS_RANKING.RELEVANCIA +
      efetividade * PESOS_RANKING.EFETIVIDADE +
      contexto * PESOS_RANKING.CONTEXTO +
      recencia * PESOS_RANKING.RECENCIA
    );
  }
}
