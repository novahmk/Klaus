// src/components/3-busca-banco/types.ts
import { Intencao } from '../1-deteccao-intencao/types';

export type TipoResposta =
  | 'base_conhecimento'
  | 'objecao_padrao'
  | 'objecao_personalizada';

export interface BuscaBancoInput {
  intencao: Intencao;
  objecao?: string;
  contexto: ContextoBusca;
  clienteId: string;
  leadId: string;
}

export interface BuscaBancoOutput {
  respostas: RespostaEncontrada[];
  totalEncontrado: number;
  tempoExecucao: number;
  origem: 'banco' | 'cache';
  timestamp: Date;
}

export interface RespostaEncontrada {
  id: string;
  tipo: TipoResposta;
  conteudo: string;
  relevancia: number;
  efetividade: number;
  palavrasChave: string[];
  clienteId: string;
  criadoEm: Date;
  atualizadoEm: Date;
}

export interface ContextoBusca {
  tema: string;
  historico: string;
  numeroMensagens: number;
  tempoNoFunil: number;
}

export interface BaseConhecimento {
  id: string;
  clienteId: string;
  tema: string;
  descricao: string;
  beneficios: string[];
  preco?: string;
  diferenciais: string[];
  casosDeUso: string[];
  embedding?: number[];
  criadoEm: Date;
  atualizadoEm: Date;
}

export interface ObjecaoPadrao {
  id: string;
  objecao: string;
  palavrasChave: string[];
  resposta: string;
  taxaEfetividade: number;
  embedding?: number[];
  criadoEm: Date;
  atualizadoEm: Date;
}

export interface ObjecaoPersonalizada {
  id: string;
  clienteId: string;
  objecao: string;
  palavrasChave: string[];
  resposta: string;
  taxaEfetividade: number;
  embedding?: number[];
  criadoEm: Date;
  atualizadoEm: Date;
}

export interface ResultadoBusca {
  respostaId: string;
  conteudo: string;
  tipo: TipoResposta;
  relevancia: number;
  efetividade: number;
}
