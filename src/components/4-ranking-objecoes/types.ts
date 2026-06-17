// src/components/4-ranking-objecoes/types.ts

export type Intencao =
  | 'QUER_AGENDAR'
  | 'QUER_MAIS_INFO'
  | 'TEM_OBJECAO'
  | 'DEMONSTRA_INTERESSE'
  | 'NAO_INTERESSADO'
  | 'NAO_RESPONDEU';

export interface Pergunta {
  id: string;
  texto: string;
  tipo: 'generica' | 'personalizada';
  score?: number;
  nicho: string;
  tema: string;
  dificuldade?: 'baixa' | 'media' | 'alta';
}

export interface ContextoLead {
  nicho: string;
  cargo: string;
  estagio: string;
}

export interface RankingInput {
  clienteId: string;
  leadId: string;
  intencao: Intencao;
  contextoLead: ContextoLead;
  perguntasCandidatas: Pergunta[];
}

export interface RankingOutput {
  perguntaSelecionada: Pergunta;
  score: number;
  motivo: string;
}
