// src/components/4-ranking-objecoes/adapter.ts
import { ContextoLead, Pergunta } from './types';

export class AdaptadorContexto {
  /**
   * Calcula o fator de contexto alinhando o cargo do lead com a
   * complexidade (dificuldade) da pergunta.
   */
  static calcularFatorContexto(
    perfil: Pick<ContextoLead, 'cargo'>,
    pergunta: Pick<Pergunta, 'dificuldade'>
  ): number {
    if (perfil.cargo === 'CEO' && pergunta.dificuldade === 'alta') return 1.0;
    if (perfil.cargo === 'Operacional' && pergunta.dificuldade === 'baixa') {
      return 1.0;
    }
    return 0.5;
  }
}
