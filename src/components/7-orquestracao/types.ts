// src/components/7-orquestracao/types.ts

export enum EstadoConversa {
  INICIAL = 'INICIAL',
  ANALISANDO_INTENCAO = 'ANALISANDO_INTENCAO',
  BUSCANDO_CONHECIMENTO = 'BUSCANDO_CONHECIMENTO',
  GERANDO_RESPOSTA = 'GERANDO_RESPOSTA',
  QUALIFICANDO_LEAD = 'QUALIFICANDO_LEAD',
  AGUARDANDO_LEAD = 'AGUARDANDO_LEAD',
  FINALIZADO = 'FINALIZADO',
  ERRO = 'ERRO'
}

export interface MensagemLead {
  id: string;
  texto: string;
  leadId: string;
  clienteId: string;
  metadata?: Record<string, unknown>;
}

export interface RespostaKlaus {
  texto: string;
  intencaoDetectada: string;
  confianca: number;
  scoreQualificacao: number;
  sugerirAgendamento: boolean;
  metadata: {
    tempoProcessamento: number;
    tokensUsados: number;
    origem: string;
    /** Sprint 8: ação recomendada pelo motor de regras de conversa dinâmicas (se habilitado e alguma regra bater). */
    acaoRecomendada?: string;
  };
}

export interface ContextoOrquestracao {
  estadoAtual: EstadoConversa;
  historicoEstados: EstadoConversa[];
  tentativas: number;
  ultimaFalha?: string;
}
