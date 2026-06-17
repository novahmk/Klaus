// src/components/6-qualificacao/types.ts

export interface ContextoLead {
  nome: string;
  telefone: string;
  email: string;
  cargo?: string;
  empresa?: string;
  nicho?: string;
}

export interface QualificacaoInput {
  clienteId: string;
  leadId: string;
  historico: unknown[];
  intencao: string;
  contextoLead: ContextoLead;
}

export interface QualificacaoOutput {
  scoreQualificacao: number;
  prioridade: number;
  estagio: string;
  notificacoes: {
    whatsapp: { enviado: boolean; status: string };
    dashboard: { enviado: boolean; status: string };
  };
}
