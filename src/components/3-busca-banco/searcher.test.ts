// src/components/3-busca-banco/searcher.test.ts
/**
 * Testes - Componente 3: Busca no Banco de Dados
 * Klaus V2
 *
 * Os testes cobrem a lógica que não depende de uma conexão real com
 * PostgreSQL. A validação do fluxo de busca contra o banco (pool.query)
 * aguarda a integração com o banco de dados.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type Redis from 'ioredis';
import { ValidadorResultados } from './validators';
import { GeradorEmbeddings } from './embeddings';
import { CacheBusca } from './cache';
import { MAPEAMENTO_INTENCAO_TIPO, CACHE_TTL } from './constants';
import { OpenAIClient } from '../../integrations/openai/client';
import { RespostaEncontrada, BuscaBancoOutput } from './types';
import { Intencao } from '../1-deteccao-intencao/types';

function criarResposta(
  overrides: Partial<RespostaEncontrada> = {}
): RespostaEncontrada {
  return {
    id: 'resp-1',
    tipo: 'base_conhecimento',
    conteudo: 'Conteúdo de resposta válido',
    relevancia: 0.9,
    efetividade: 0.8,
    palavrasChave: ['tema'],
    clienteId: 'cliente-1',
    criadoEm: new Date(),
    atualizadoEm: new Date(),
    ...overrides
  };
}

describe('Componente 3 - ValidadorResultados', () => {
  let validador: ValidadorResultados;

  beforeEach(() => {
    validador = new ValidadorResultados();
  });

  it('deve validar resposta dentro dos limites', () => {
    expect(validador.validar(criarResposta())).toBe(true);
  });

  it('deve rejeitar resposta com relevância baixa', () => {
    expect(validador.validar(criarResposta({ relevancia: 0.5 }))).toBe(false);
  });

  it('deve rejeitar resposta com efetividade baixa', () => {
    expect(validador.validar(criarResposta({ efetividade: 0.1 }))).toBe(false);
  });

  it('deve rejeitar resposta com conteúdo vazio', () => {
    expect(validador.validar(criarResposta({ conteudo: '   ' }))).toBe(false);
  });

  it('deve filtrar respostas inválidas', () => {
    const respostas = [
      criarResposta({ id: 'ok' }),
      criarResposta({ id: 'baixa-relevancia', relevancia: 0.2 }),
      criarResposta({ id: 'vazio', conteudo: '' })
    ];

    const filtradas = validador.filtrar(respostas);
    expect(filtradas).toHaveLength(1);
    expect(filtradas[0].id).toBe('ok');
  });

  it('deve limitar resultados ao máximo permitido', () => {
    const respostas = Array.from({ length: 10 }, (_, i) =>
      criarResposta({ id: `resp-${i}` })
    );

    const filtradas = validador.filtrar(respostas);
    expect(filtradas).toHaveLength(5);
  });

  it('deve detectar resultados suficientes', () => {
    expect(validador.temResultadosSuficientes([criarResposta()])).toBe(true);
    expect(validador.temResultadosSuficientes([])).toBe(false);
  });

  it('deve calcular score combinando relevância e efetividade', () => {
    const score = validador.calcularScore(
      criarResposta({ relevancia: 1, efetividade: 0.6 })
    );
    expect(score).toBeCloseTo(0.8, 5);
  });
});

describe('Componente 3 - GeradorEmbeddings (similaridade)', () => {
  let gerador: GeradorEmbeddings;

  beforeEach(() => {
    // Cliente não é usado por calcularSimilaridade
    gerador = new GeradorEmbeddings({} as OpenAIClient);
  });

  it('deve retornar 1 para vetores idênticos', () => {
    const v = [1, 2, 3];
    expect(gerador.calcularSimilaridade(v, [...v])).toBeCloseTo(1, 5);
  });

  it('deve retornar 0 para vetores ortogonais', () => {
    expect(gerador.calcularSimilaridade([1, 0], [0, 1])).toBeCloseTo(0, 5);
  });

  it('deve retornar 0 quando um vetor é nulo', () => {
    expect(gerador.calcularSimilaridade([0, 0], [1, 1])).toBe(0);
  });

  it('deve lançar erro para vetores de tamanhos diferentes', () => {
    expect(() => gerador.calcularSimilaridade([1, 2], [1])).toThrow(
      'Embeddings com tamanhos diferentes'
    );
  });
});

describe('Componente 3 - MAPEAMENTO_INTENCAO_TIPO', () => {
  it('deve mapear todas as intenções', () => {
    expect(MAPEAMENTO_INTENCAO_TIPO[Intencao.QUER_AGENDAR]).toContain(
      'base_conhecimento'
    );
    expect(MAPEAMENTO_INTENCAO_TIPO[Intencao.TEM_OBJECAO]).toContain(
      'objecao_padrao'
    );
    expect(MAPEAMENTO_INTENCAO_TIPO[Intencao.NAO_RESPONDEU]).toHaveLength(0);
    expect(MAPEAMENTO_INTENCAO_TIPO[Intencao.NAO_INTERESSADO]).toEqual([
      'objecao_padrao'
    ]);
  });
});

describe('Componente 3 - CacheBusca', () => {
  let store: Map<string, string>;
  let redisStub: Redis;
  let setexSpy: ReturnType<typeof vi.fn>;
  let cache: CacheBusca;

  beforeEach(() => {
    store = new Map();
    setexSpy = vi.fn((chave: string, _ttl: number, valor: string) => {
      store.set(chave, valor);
      return Promise.resolve('OK');
    });

    redisStub = {
      get: (chave: string) => Promise.resolve(store.get(chave) ?? null),
      setex: setexSpy,
      keys: (pattern: string) => {
        const prefixo = pattern.replace(/\*$/, '');
        return Promise.resolve(
          Array.from(store.keys()).filter((k) => k.startsWith(prefixo))
        );
      },
      del: (...chaves: string[]) => {
        chaves.forEach((k) => store.delete(k));
        return Promise.resolve(chaves.length);
      }
    } as unknown as Redis;

    cache = new CacheBusca(redisStub);
  });

  function criarOutput(): BuscaBancoOutput {
    return {
      respostas: [criarResposta()],
      totalEncontrado: 1,
      tempoExecucao: 10,
      origem: 'banco',
      timestamp: new Date()
    };
  }

  it('deve retornar null quando não há entrada no cache', async () => {
    const resultado = await cache.buscar('cliente-1', 'QUER_MAIS_INFO');
    expect(resultado).toBeNull();
  });

  it('deve salvar e recuperar do cache marcando origem cache', async () => {
    await cache.salvar('cliente-1', 'QUER_MAIS_INFO', criarOutput());
    const resultado = await cache.buscar('cliente-1', 'QUER_MAIS_INFO');

    expect(resultado).not.toBeNull();
    expect(resultado?.origem).toBe('cache');
    expect(resultado?.totalEncontrado).toBe(1);
  });

  it('deve usar TTL padrão sem objeção e personalizado com objeção', async () => {
    await cache.salvar('cliente-1', 'QUER_MAIS_INFO', criarOutput());
    await cache.salvar('cliente-1', 'TEM_OBJECAO', criarOutput(), 'Preço');

    expect(setexSpy).toHaveBeenCalledWith(
      'busca:cliente-1:QUER_MAIS_INFO',
      CACHE_TTL.BUSCA_PADRAO,
      expect.any(String)
    );
    expect(setexSpy).toHaveBeenCalledWith(
      'busca:cliente-1:TEM_OBJECAO:Preço',
      CACHE_TTL.BUSCA_PERSONALIZADA,
      expect.any(String)
    );
  });

  it('deve gerar chave diferenciada com objeção', async () => {
    await cache.salvar('cliente-1', 'TEM_OBJECAO', criarOutput(), 'Preço');
    const semObjecao = await cache.buscar('cliente-1', 'TEM_OBJECAO');
    const comObjecao = await cache.buscar('cliente-1', 'TEM_OBJECAO', 'Preço');

    expect(semObjecao).toBeNull();
    expect(comObjecao).not.toBeNull();
  });

  it('deve limpar todas as chaves de um cliente', async () => {
    await cache.salvar('cliente-1', 'QUER_MAIS_INFO', criarOutput());
    await cache.salvar('cliente-1', 'TEM_OBJECAO', criarOutput(), 'Preço');

    await cache.limpar('cliente-1');

    expect(await cache.buscar('cliente-1', 'QUER_MAIS_INFO')).toBeNull();
    expect(
      await cache.buscar('cliente-1', 'TEM_OBJECAO', 'Preço')
    ).toBeNull();
  });

  it('deve invalidar cache por intenção', async () => {
    await cache.salvar('cliente-1', 'TEM_OBJECAO', criarOutput(), 'Preço');
    await cache.salvar('cliente-1', 'QUER_MAIS_INFO', criarOutput());

    await cache.invalidarPorIntencao('cliente-1', 'TEM_OBJECAO');

    expect(
      await cache.buscar('cliente-1', 'TEM_OBJECAO', 'Preço')
    ).toBeNull();
    expect(await cache.buscar('cliente-1', 'QUER_MAIS_INFO')).not.toBeNull();
  });
});
