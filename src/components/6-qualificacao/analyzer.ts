// src/components/6-qualificacao/analyzer.ts

export class AnalisadorHistorico {
  analisar(historico: unknown[]): {
    totalMensagens: number;
    sentimento: string;
    taxaResposta: number;
  } {
    return {
      totalMensagens: historico.length,
      sentimento: 'positivo',
      taxaResposta: 1.0
    };
  }
}
