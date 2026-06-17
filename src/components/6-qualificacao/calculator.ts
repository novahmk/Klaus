// src/components/6-qualificacao/calculator.ts
import { PESOS, SCORES_INTENCAO } from './constants';
import { QualificacaoInput, ContextoLead } from './types';

export class CalculadorScore {
  calcular(input: QualificacaoInput): number {
    const sIntencao = SCORES_INTENCAO[input.intencao] || 0;
    const sEngajamento = this.calcularEngajamento(input.historico);
    const sContexto = this.calcularContexto(input.contextoLead);
    const sHistorico = 80; // Default para novos leads

    return (
      sIntencao * PESOS.INTENCAO +
      sEngajamento * PESOS.ENGAJAMENTO +
      sContexto * PESOS.CONTEXTO +
      sHistorico * PESOS.HISTORICO
    );
  }

  private calcularEngajamento(historico: unknown[]): number {
    return Math.min(historico.length * 10, 100);
  }

  private calcularContexto(contexto: ContextoLead): number {
    return contexto.cargo ? 90 : 50;
  }
}
