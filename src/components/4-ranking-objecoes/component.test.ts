// src/components/4-ranking-objecoes/component.test.ts
/**
 * Testes - Componente 4: Ranking de Objeções Adaptativo
 * Klaus V2
 *
 * Cobrem a lógica independente de banco. A busca real no PostgreSQL
 * (QUERIES via pool.query) aguarda a integração com o banco de dados.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type Redis from 'ioredis';
import { RankerPerguntas } from './ranker';
import { AdaptadorContexto } from './adapter';
import { CacheRanking } from './cache';
import { ComponenteRanking } from './component';
import { PESOS_RANKING } from './constants';
import { Pergunta, RankingInput } from './types';

describe('Componente 4 - RankerPerguntas', () => {
  it('deve calcular score com média ponderada', () => {
    const score = RankerPerguntas.calcularScoreFinal(1, 1, 1, 1);
    expect(score).toBeCloseTo(1, 5);
  });

  it('deve respeitar os pesos definidos', () => {
    const score = RankerPerguntas.calcularScoreFinal(1, 0, 0, 0);
    expect(score).toBeCloseTo(PESOS_RANKING.RELEVANCIA, 5);
  });

  it('deve combinar todas as variáveis corretamente', () => {
    const score = RankerPerguntas.calcularScoreFinal(0.8, 0.7, 0.9, 1.0);
    const esperado =
      0.8 * 0.4 + 0.7 * 0.3 + 0.9 * 0.2 + 1.0 * 0.1;
    expect(score).toBeCloseTo(esperado, 5);
  });

  it('deve retornar 0 quando todas as variáveis são 0', () => {
    expect(RankerPerguntas.calcularScoreFinal(0, 0, 0, 0)).toBe(0);
  });
});

describe('Componente 4 - AdaptadorContexto', () => {
  it('deve retornar 1.0 para CEO com pergunta de alta dificuldade', () => {
    const fator = AdaptadorContexto.calcularFatorContexto(
      { cargo: 'CEO' },
      { dificuldade: 'alta' }
    );
    expect(fator).toBe(1.0);
  });

  it('deve retornar 1.0 para Operacional com pergunta de baixa dificuldade', () => {
    const fator = AdaptadorContexto.calcularFatorContexto(
      { cargo: 'Operacional' },
      { dificuldade: 'baixa' }
    );
    expect(fator).toBe(1.0);
  });

  it('deve retornar 0.5 para combinações não alinhadas', () => {
    expect(
      AdaptadorContexto.calcularFatorContexto(
        { cargo: 'CEO' },
        { dificuldade: 'baixa' }
      )
    ).toBe(0.5);
    expect(
      AdaptadorContexto.calcularFatorContexto(
        { cargo: 'Diretor Clínico' },
        { dificuldade: 'alta' }
      )
    ).toBe(0.5);
  });
});

describe('Componente 4 - ComponenteRanking.executar', () => {
  let componente: ComponenteRanking;

  beforeEach(() => {
    // Pool e cache não são acessados no fluxo simulado de executar()
    componente = new ComponenteRanking({} as never, {});
  });

  function criarInput(perguntas: Pergunta[]): RankingInput {
    return {
      clienteId: 'cliente-1',
      leadId: 'lead-1',
      intencao: 'QUER_MAIS_INFO',
      contextoLead: {
        nicho: 'saude',
        cargo: 'Diretor Clínico',
        estagio: 'em_conversa'
      },
      perguntasCandidatas: perguntas
    };
  }

  it('deve selecionar uma pergunta vencedora com score', async () => {
    const resultado = await componente.executar(
      criarInput([
        {
          id: 'p1',
          texto: 'Pergunta 1?',
          tipo: 'generica',
          nicho: 'saude',
          tema: 'a'
        },
        {
          id: 'p2',
          texto: 'Pergunta 2?',
          tipo: 'personalizada',
          nicho: 'saude',
          tema: 'b'
        }
      ])
    );

    expect(resultado.perguntaSelecionada).toBeDefined();
    expect(resultado.score).toBeGreaterThan(0);
    expect(resultado.motivo.length).toBeGreaterThan(0);
  });

  it('deve atribuir score a cada candidata', async () => {
    const resultado = await componente.executar(
      criarInput([
        {
          id: 'p1',
          texto: 'Pergunta única?',
          tipo: 'generica',
          nicho: 'saude',
          tema: 'a'
        }
      ])
    );

    expect(resultado.perguntaSelecionada.id).toBe('p1');
    expect(resultado.perguntaSelecionada.score).toBeCloseTo(0.81, 5);
    expect(resultado.score).toBeCloseTo(0.81, 5);
  });
});

describe('Componente 4 - CacheRanking', () => {
  let store: Map<string, string>;
  let redisStub: Redis;
  let setexSpy: ReturnType<typeof vi.fn>;
  let cache: CacheRanking;

  beforeEach(() => {
    store = new Map();
    setexSpy = vi.fn((chave: string, _ttl: number, valor: string) => {
      store.set(chave, valor);
      return Promise.resolve('OK');
    });

    redisStub = {
      get: (chave: string) => Promise.resolve(store.get(chave) ?? null),
      setex: setexSpy
    } as unknown as Redis;

    cache = new CacheRanking(redisStub);
  });

  it('deve retornar null quando não há entrada', async () => {
    expect(await cache.getCachedRanking('inexistente')).toBeNull();
  });

  it('deve salvar com prefixo e TTL de 3600s', async () => {
    await cache.setCachedRanking('abc', { vencedora: 'p1' });

    expect(setexSpy).toHaveBeenCalledWith(
      'ranking:abc',
      3600,
      JSON.stringify({ vencedora: 'p1' })
    );
  });

  it('deve recuperar valor salvo', async () => {
    await cache.setCachedRanking('abc', { vencedora: 'p1' });
    const valor = await cache.getCachedRanking('abc');
    expect(valor).toBe(JSON.stringify({ vencedora: 'p1' }));
  });
});
