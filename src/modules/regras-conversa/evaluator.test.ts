// src/modules/regras-conversa/evaluator.test.ts
/**
 * Testes - Avaliador seguro de condições de regras de conversa (Sprint 8)
 *
 * Garante que nenhuma condição é executada como código (sem eval/new Function)
 * e que campos/operadores fora do whitelist nunca correspondem.
 */

import { describe, it, expect } from 'vitest';
import { avaliarCondicao } from './evaluator';
import { CondicaoRegra, ContextoAvaliacaoRegra } from './types';

function contexto(overrides: Partial<ContextoAvaliacaoRegra> = {}): ContextoAvaliacaoRegra {
  return { score: 75, estagio: 'QUALIFICADO', tentativas: 2, ...overrides };
}

describe('regras-conversa - avaliarCondicao', () => {
  it('deve avaliar operador >= corretamente (score)', () => {
    const condicao: CondicaoRegra = { campo: 'score', operador: '>=', valor: 70 };
    expect(avaliarCondicao(condicao, contexto({ score: 70 }))).toBe(true);
    expect(avaliarCondicao(condicao, contexto({ score: 69 }))).toBe(false);
  });

  it('deve avaliar operador < corretamente (score)', () => {
    const condicao: CondicaoRegra = { campo: 'score', operador: '<', valor: 30 };
    expect(avaliarCondicao(condicao, contexto({ score: 20 }))).toBe(true);
    expect(avaliarCondicao(condicao, contexto({ score: 30 }))).toBe(false);
  });

  it('deve avaliar igualdade de string (estagio)', () => {
    const condicao: CondicaoRegra = {
      campo: 'estagio',
      operador: '==',
      valor: 'PRONTO_PARA_HANDOFF'
    };
    expect(
      avaliarCondicao(condicao, contexto({ estagio: 'PRONTO_PARA_HANDOFF' }))
    ).toBe(true);
    expect(
      avaliarCondicao(condicao, contexto({ estagio: 'QUALIFICADO' }))
    ).toBe(false);
  });

  it('deve avaliar diferença (!=) e tentativas', () => {
    const condicao: CondicaoRegra = { campo: 'tentativas', operador: '!=', valor: 0 };
    expect(avaliarCondicao(condicao, contexto({ tentativas: 3 }))).toBe(true);
    expect(avaliarCondicao(condicao, contexto({ tentativas: 0 }))).toBe(false);
  });

  it('deve retornar false (nunca lançar) para campo fora do whitelist', () => {
    const condicaoMaliciosa = {
      campo: 'process',
      operador: '==',
      valor: 'qualquer'
    } as unknown as CondicaoRegra;

    expect(() => avaliarCondicao(condicaoMaliciosa, contexto())).not.toThrow();
    expect(avaliarCondicao(condicaoMaliciosa, contexto())).toBe(false);
  });

  it('deve retornar false (nunca lançar) para operador fora do whitelist', () => {
    const condicaoMaliciosa = {
      campo: 'score',
      operador: 'require',
      valor: 70
    } as unknown as CondicaoRegra;

    expect(() => avaliarCondicao(condicaoMaliciosa, contexto())).not.toThrow();
    expect(avaliarCondicao(condicaoMaliciosa, contexto())).toBe(false);
  });

  it('deve retornar false para condição nula/indefinida', () => {
    expect(avaliarCondicao(null as unknown as CondicaoRegra, contexto())).toBe(
      false
    );
    expect(
      avaliarCondicao(undefined as unknown as CondicaoRegra, contexto())
    ).toBe(false);
  });

  it('nunca deve executar strings como código (não há eval/new Function)', () => {
    // Mesmo se alguém tentasse injetar um "payload" de código via `valor`,
    // ele é tratado apenas como valor de comparação de string, nunca executado.
    const condicao: CondicaoRegra = {
      campo: 'estagio',
      operador: '==',
      valor: 'process.exit(1)'
    };
    expect(() => avaliarCondicao(condicao, contexto())).not.toThrow();
    expect(avaliarCondicao(condicao, contexto())).toBe(false);
  });
});
