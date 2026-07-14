// src/modules/regras-conversa/service.test.ts
/**
 * Testes - avaliarRegrasContra (Sprint 8)
 * Função pura: não depende de Supabase/cache, cobre a lógica de
 * "primeira regra que corresponde, em ordem".
 */

import { describe, it, expect } from 'vitest';
import { avaliarRegrasContra } from './service';
import { RegraConversa } from './types';

function criarRegra(overrides: Partial<RegraConversa> = {}): RegraConversa {
  return {
    id: 'regra-1',
    clienteId: 'cliente-1',
    nome: 'Regra padrão',
    condicao: { campo: 'score', operador: '>=', valor: 70 },
    acao: 'acompanhar',
    scoreImpacto: 0,
    ordem: 0,
    ativo: true,
    ...overrides
  };
}

describe('regras-conversa - avaliarRegrasContra', () => {
  it('deve retornar null quando nenhuma regra corresponde', () => {
    const regras = [criarRegra({ condicao: { campo: 'score', operador: '>=', valor: 90 } })];
    const resultado = avaliarRegrasContra(regras, {
      score: 50,
      estagio: 'QUALIFICADO',
      tentativas: 0
    });
    expect(resultado).toBeNull();
  });

  it('deve retornar a primeira regra (em ordem) cuja condição corresponde', () => {
    const regras = [
      criarRegra({
        nome: 'Lead frio',
        ordem: 1,
        condicao: { campo: 'score', operador: '<', valor: 30 },
        acao: 'nurture'
      }),
      criarRegra({
        nome: 'Lead quente',
        ordem: 2,
        condicao: { campo: 'score', operador: '>=', valor: 70 },
        acao: 'agendar_demo'
      })
    ];

    const resultado = avaliarRegrasContra(regras, {
      score: 85,
      estagio: 'QUALIFICADO',
      tentativas: 1
    });

    expect(resultado).toEqual({
      regra: 'Lead quente',
      acao: 'agendar_demo',
      scoreImpacto: 0,
      ordem: 2
    });
  });

  it('deve respeitar a ordem do array (primeira correspondência vence)', () => {
    const regras = [
      criarRegra({
        nome: 'Regra genérica',
        ordem: 1,
        condicao: { campo: 'score', operador: '>=', valor: 0 },
        acao: 'acao_generica'
      }),
      criarRegra({
        nome: 'Regra específica',
        ordem: 2,
        condicao: { campo: 'score', operador: '>=', valor: 70 },
        acao: 'acao_especifica'
      })
    ];

    const resultado = avaliarRegrasContra(regras, {
      score: 85,
      estagio: 'QUALIFICADO',
      tentativas: 0
    });

    // A primeira regra do array já corresponde (score >= 0), então vence.
    expect(resultado?.acao).toBe('acao_generica');
  });

  it('deve retornar null para lista vazia', () => {
    expect(
      avaliarRegrasContra([], { score: 100, estagio: 'QUALIFICADO', tentativas: 0 })
    ).toBeNull();
  });
});
