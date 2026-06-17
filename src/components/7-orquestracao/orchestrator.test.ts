// src/components/7-orquestracao/orchestrator.test.ts
/**
 * Testes - Componente 7: Orquestrador Enterprise
 * Klaus V2
 *
 * Cobrem a lógica independente de DB/componentes reais, usando stubs.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type Redis from 'ioredis';
import { EstadoConversa, MensagemLead } from './types';
import { StateMachine } from './state-machine';
import { CircuitBreaker, CircuitState } from './circuit-breaker';
import { ErrorHandler } from './error-handler';
import { CacheManager } from './cache-manager';
import { OrquestradorKlaus } from './orchestrator';
import { ORCHESTRATOR_CONFIG } from './constants';

describe('Componente 7 - StateMachine', () => {
  let sm: StateMachine;

  beforeEach(() => {
    sm = new StateMachine();
  });

  it('deve aceitar transição válida', () => {
    expect(
      sm.validarTransicao(
        EstadoConversa.INICIAL,
        EstadoConversa.ANALISANDO_INTENCAO
      )
    ).toBe(true);
  });

  it('deve rejeitar transição inválida', () => {
    expect(
      sm.validarTransicao(
        EstadoConversa.INICIAL,
        EstadoConversa.QUALIFICANDO_LEAD
      )
    ).toBe(false);
  });

  it('deve permitir ERRO a partir de qualquer estado de processamento', () => {
    expect(
      sm.validarTransicao(
        EstadoConversa.GERANDO_RESPOSTA,
        EstadoConversa.ERRO
      )
    ).toBe(true);
  });

  it('deve permitir reinício a partir de FINALIZADO', () => {
    expect(
      sm.validarTransicao(EstadoConversa.FINALIZADO, EstadoConversa.INICIAL)
    ).toBe(true);
  });
});

describe('Componente 7 - CircuitBreaker', () => {
  it('deve executar normalmente quando fechado', async () => {
    const cb = new CircuitBreaker(3, 1000);
    const resultado = await cb.execute(() => Promise.resolve('ok'));
    expect(resultado).toBe('ok');
  });

  it('deve abrir após atingir o threshold de falhas', async () => {
    const cb = new CircuitBreaker(3, 60000);
    const falha = () => Promise.reject(new Error('falha'));

    for (let i = 0; i < 3; i++) {
      await expect(cb.execute(falha)).rejects.toThrow('falha');
    }

    // 4ª chamada: circuito aberto
    await expect(cb.execute(falha)).rejects.toThrow('Circuit Breaker is OPEN');
  });

  it('deve passar para HALF_OPEN após o resetTimeout e fechar no sucesso', async () => {
    const cb = new CircuitBreaker(1, 10);
    await expect(
      cb.execute(() => Promise.reject(new Error('falha')))
    ).rejects.toThrow('falha');

    // Aguarda o reset
    await new Promise((r) => setTimeout(r, 20));

    const resultado = await cb.execute(() => Promise.resolve('recuperado'));
    expect(resultado).toBe('recuperado');
  });
});

describe('Componente 7 - ErrorHandler', () => {
  it('deve retornar sucesso na primeira tentativa', async () => {
    const fn = vi.fn(() => Promise.resolve('ok'));
    const resultado = await ErrorHandler.retry(fn, 3, 1);
    expect(resultado).toBe('ok');
    expect(fn).toHaveBeenCalledOnce();
  });

  it('deve retentar até o limite e então falhar', async () => {
    const fn = vi.fn(() => Promise.reject(new Error('persistente')));
    await expect(ErrorHandler.retry(fn, 3, 1)).rejects.toThrow('persistente');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('deve ter sucesso após falhas transientes', async () => {
    let chamadas = 0;
    const fn = vi.fn(() => {
      chamadas++;
      if (chamadas < 2) return Promise.reject(new Error('transiente'));
      return Promise.resolve('recuperado');
    });
    const resultado = await ErrorHandler.retry(fn, 3, 1);
    expect(resultado).toBe('recuperado');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('deve retornar fallback específico por intenção', () => {
    expect(ErrorHandler.getFallbackResponse('QUER_AGENDAR')).toContain(
      'agendar'
    );
  });

  it('deve retornar fallback default para intenção desconhecida', () => {
    expect(ErrorHandler.getFallbackResponse('XPTO')).toContain('problema técnico');
    expect(ErrorHandler.getFallbackResponse()).toContain('problema técnico');
  });
});

describe('Componente 7 - CacheManager', () => {
  let store: Map<string, string>;
  let redisStub: Redis;
  let setexSpy: ReturnType<typeof vi.fn>;
  let cache: CacheManager;

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
    cache = new CacheManager(redisStub);
  });

  it('deve gerar chave determinística com prefixo e hash', () => {
    const chave1 = cache.gerarChave('lead-1', 'Bom dia');
    const chave2 = cache.gerarChave('lead-1', 'Bom dia');
    const chave3 = cache.gerarChave('lead-1', 'Boa tarde');

    expect(chave1).toBe(chave2);
    expect(chave1).not.toBe(chave3);
    expect(chave1.startsWith(ORCHESTRATOR_CONFIG.CACHE.PREFIXO)).toBe(true);
  });

  it('deve salvar e recuperar valores', async () => {
    const chave = cache.gerarChave('lead-1', 'msg');
    await cache.set(chave, { texto: 'oi' });
    const valor = await cache.get<{ texto: string }>(chave);
    expect(valor).toEqual({ texto: 'oi' });
  });

  it('deve usar TTL padrão ao salvar', async () => {
    const chave = cache.gerarChave('lead-1', 'msg');
    await cache.set(chave, { a: 1 });
    expect(setexSpy).toHaveBeenCalledWith(
      chave,
      ORCHESTRATOR_CONFIG.CACHE.TTL_PADRAO,
      expect.any(String)
    );
  });

  it('deve retornar null para chave inexistente', async () => {
    expect(await cache.get('inexistente')).toBeNull();
  });
});

describe('Componente 7 - OrquestradorKlaus.processar', () => {
  let store: Map<string, string>;
  let redisStub: Redis;
  let cache: CacheManager;
  let comp1: { detectar: ReturnType<typeof vi.fn> };
  let comp3: { buscar: ReturnType<typeof vi.fn> };
  let comp5: { gerar: ReturnType<typeof vi.fn> };
  let comp6: { analisar: ReturnType<typeof vi.fn> };
  let orquestrador: OrquestradorKlaus;

  const mensagem: MensagemLead = {
    id: 'msg-1',
    texto: 'Como funciona o plano?',
    leadId: 'lead-456',
    clienteId: 'cliente-123'
  };

  beforeEach(() => {
    store = new Map();
    redisStub = {
      get: (chave: string) => Promise.resolve(store.get(chave) ?? null),
      setex: (chave: string, _ttl: number, valor: string) => {
        store.set(chave, valor);
        return Promise.resolve('OK');
      }
    } as unknown as Redis;
    cache = new CacheManager(redisStub);

    comp1 = {
      detectar: vi.fn(() =>
        Promise.resolve({ intencao: 'QUER_MAIS_INFO', confianca: 0.92 })
      )
    };
    comp3 = { buscar: vi.fn(() => Promise.resolve('contexto da base')) };
    comp5 = { gerar: vi.fn(() => Promise.resolve('Resposta gerada.')) };
    comp6 = { analisar: vi.fn(() => Promise.resolve({ score: 85 })) };

    orquestrador = new OrquestradorKlaus(
      new StateMachine(),
      cache,
      comp1,
      {},
      comp3,
      comp5,
      comp6
    );
  });

  it('deve processar fluxo completo e retornar RespostaKlaus', async () => {
    const resposta = await orquestrador.processar(mensagem);

    expect(comp1.detectar).toHaveBeenCalledOnce();
    expect(comp3.buscar).toHaveBeenCalledOnce(); // QUER_MAIS_INFO aciona busca
    expect(comp5.gerar).toHaveBeenCalledOnce();
    expect(comp6.analisar).toHaveBeenCalledOnce();

    expect(resposta.texto).toBe('Resposta gerada.');
    expect(resposta.intencaoDetectada).toBe('QUER_MAIS_INFO');
    expect(resposta.scoreQualificacao).toBe(85);
    expect(resposta.sugerirAgendamento).toBe(true); // score > 80
    expect(resposta.metadata.origem).toBe('orchestrator_v2');
  });

  it('não deve acionar busca para intenções que não exigem contexto', async () => {
    comp1.detectar.mockResolvedValueOnce({
      intencao: 'DEMONSTRA_INTERESSE',
      confianca: 0.8
    });

    await orquestrador.processar(mensagem);

    expect(comp3.buscar).not.toHaveBeenCalled();
    expect(comp5.gerar).toHaveBeenCalledOnce();
  });

  it('deve retornar do cache sem reprocessar', async () => {
    await orquestrador.processar(mensagem);
    comp1.detectar.mockClear();
    comp5.gerar.mockClear();

    const segunda = await orquestrador.processar(mensagem);

    expect(comp1.detectar).not.toHaveBeenCalled();
    expect(comp5.gerar).not.toHaveBeenCalled();
    expect(segunda.texto).toBe('Resposta gerada.');
  });

  it('deve retornar resposta de fallback em caso de erro', async () => {
    comp5.gerar.mockRejectedValue(new Error('falha na geração'));

    const resposta = await orquestrador.processar(mensagem);

    expect(resposta.intencaoDetectada).toBe('ERRO_SISTEMA');
    expect(resposta.confianca).toBe(0);
    expect(resposta.metadata.origem).toBe('fallback');
    expect(resposta.texto.length).toBeGreaterThan(0);
  });
});
