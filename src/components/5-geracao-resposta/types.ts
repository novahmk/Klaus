// src/components/5-geracao-resposta/types.ts

export type TipoObjecao =
  | 'PRECO'
  | 'TIMING'
  | 'SOLUCAO'
  | 'TECNICO'
  | 'GENERICO';

export interface ContextoLead {
  cargo: string;
  empresa: string;
  nicho: string;
  estagio: string;
}

export interface GeracaoInput {
  clienteId: string;
  leadId: string;
  objecao: string;
  tipoObjecao: TipoObjecao;
  contextoLead: ContextoLead;
  baseConhecimento: unknown;
  historico: { remetente: string; texto: string }[];
}

export interface GeracaoOutput {
  resposta: string;
  confianca: number;
  motivo: string;
  tokensUsados: number;
}
