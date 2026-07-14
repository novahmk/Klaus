/**
 * Sprint 8: Regras de Conversa Dinâmicas
 * Tipos para o motor de regras condição -> ação.
 *
 * IMPORTANTE (segurança): as condições são sempre estruturadas em JSON
 * ({ campo, operador, valor }), nunca strings de código avaliadas em
 * runtime (sem eval / new Function). Ver evaluator.ts.
 */

export type CampoCondicao = 'score' | 'estagio' | 'tentativas';

export type OperadorCondicao = '>' | '>=' | '<' | '<=' | '==' | '!=';

export interface CondicaoRegra {
  campo: CampoCondicao;
  operador: OperadorCondicao;
  valor: number | string;
}

export interface RegraConversa {
  id: string;
  clienteId: string;
  nome: string;
  condicao: CondicaoRegra;
  acao: string;
  scoreImpacto: number;
  ordem: number;
  ativo: boolean;
}

/**
 * Contexto de execução usado para avaliar as condições das regras.
 */
export interface ContextoAvaliacaoRegra {
  score: number;
  estagio: string;
  tentativas: number;
}

export interface ResultadoRegra {
  regra: string;
  acao: string;
  scoreImpacto: number;
  ordem: number;
}
