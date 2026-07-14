// src/components/6-qualificacao/calculator.ts
import { PESOS, SCORES_INTENCAO } from './constants';
import { QualificacaoInput, ContextoLead } from './types';

export interface PesosScore {
  INTENCAO: number;
  ENGAJAMENTO: number;
  CONTEXTO: number;
  HISTORICO: number;
}

export class CalculadorScore {
  /**
   * Calcula o score de qualificação.
   * `pesos` e `scoresIntencao` são opcionais — por padrão usam as
   * constantes fixas do Componente 6. Sprint 7: podem vir de configuração
   * dinâmica carregada via `obterConfigScoring` (config-loader/Supabase).
   */
  calcular(
    input: QualificacaoInput,
    pesos: PesosScore = PESOS,
    scoresIntencao: Record<string, number> = SCORES_INTENCAO
  ): number {
    const sIntencao = scoresIntencao[input.intencao] ?? 0;
    const sEngajamento = this.calcularEngajamento(input.historico);
    const sContexto = this.calcularContexto(input.contextoLead);
    const sHistorico = 80; // Default para novos leads

    return (
      sIntencao * pesos.INTENCAO +
      sEngajamento * pesos.ENGAJAMENTO +
      sContexto * pesos.CONTEXTO +
      sHistorico * pesos.HISTORICO
    );
  }

  private calcularEngajamento(historico: unknown[]): number {
    return Math.min(historico.length * 10, 100);
  }

  private calcularContexto(contexto: ContextoLead): number {
    return contexto.cargo ? 90 : 50;
  }
}
