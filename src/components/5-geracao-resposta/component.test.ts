// src/components/5-geracao-resposta/component.test.ts
/**
 * Testes - Componente 5: Geração de Resposta (Fallback IA)
 * Klaus V2
 *
 * Cobrem a lógica independente de DB/OpenAI real, usando stubs.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { OpenAI } from 'openai';
import type { Pool } from 'pg';
import type Redis from 'ioredis';
import { ValidadorResposta } from './validator';
import { PromptBuilder } from './prompts';
import { ComponenteGeracao } from './component';
import { INSTRUCOES_TOM } from './constants';
import { GeracaoInput } from './types';

function criarInput(overrides: Partial<GeracaoInput> = {}): GeracaoInput {
  return {
    clienteId: 'cliente-1',
    leadId: 'lead-1',
    objecao: 'Está acima do orçamento.',
    tipoObjecao: 'PRECO',
    contextoLead: {
      cargo: 'Diretor Clínico',
      empresa: 'Clínica Vida',
      nicho: 'saude',
      estagio: 'em_conversa'
    },
    baseConhecimento: { diferenciais: ['ROI rápido'] },
    historico: [{ remetente: 'lead', texto: 'Caro demais' }],
    ...overrides
  };
}

describe('Componente 5 - ValidadorResposta', () => {
  it('deve dar score máximo para resposta completa com CTA', () => {
    const resposta =
      'Entendo sua preocupação com o investimento. ' +
      'Considerando o ROI projetado e os diferenciais da solução, ' +
      'o custo se paga rapidamente. Podemos revisar juntos os números ' +
      'para encontrar o melhor caminho para você?';
    expect(ValidadorResposta.validar(resposta)).toBe(100);
  });

  it('deve penalizar resposta curta', () => {
    expect(ValidadorResposta.validar('Resposta curta?')).toBe(70);
  });

  it('deve penalizar ausência de CTA (sem ?)', () => {
    const resposta =
      'Entendo perfeitamente a sua preocupação com o investimento inicial e quero ' +
      'demonstrar com clareza como o retorno obtido supera o custo ao longo do ' +
      'primeiro ano de uso da solução, trazendo ganhos consistentes para a equipe.';
    expect(resposta.length).toBeGreaterThanOrEqual(150);
    expect(ValidadorResposta.validar(resposta)).toBe(90);
  });

  it('deve penalizar tom negativo (infelizmente)', () => {
    const resposta =
      'Infelizmente o valor padrão é esse mesmo, porém quero mostrar com calma ' +
      'como o retorno obtido supera o custo inicial com boa folga ao longo do ' +
      'primeiro ano de uso. Podemos conversar sobre as melhores opções para você?';
    expect(resposta.length).toBeGreaterThanOrEqual(150);
    expect(ValidadorResposta.validar(resposta)).toBe(80);
  });

  it('aplica piso de 0 e acumula penalidades no pior caso', () => {
    // curta (-30) + sem '?' (-10) + 'infelizmente' (-20) = 40
    expect(ValidadorResposta.validar('infelizmente')).toBe(40);
  });
});

describe('Componente 5 - PromptBuilder', () => {
  it('deve incluir objeção e contexto no prompt', () => {
    const prompt = PromptBuilder.build(criarInput());
    expect(prompt).toContain('PRECO');
    expect(prompt).toContain('Diretor Clínico');
    expect(prompt).toContain('Está acima do orçamento.');
  });

  it('deve aplicar tom executivo para diretor/ceo', () => {
    const prompt = PromptBuilder.build(
      criarInput({
        contextoLead: {
          cargo: 'CEO',
          empresa: 'X',
          nicho: 'tech',
          estagio: 'novo'
        }
      })
    );
    expect(prompt).toContain(INSTRUCOES_TOM.EXECUTIVO);
  });

  it('deve aplicar tom técnico para engenheiro/cto', () => {
    const prompt = PromptBuilder.build(
      criarInput({
        contextoLead: {
          cargo: 'CTO',
          empresa: 'X',
          nicho: 'tech',
          estagio: 'novo'
        }
      })
    );
    expect(prompt).toContain(INSTRUCOES_TOM.TECNICO);
  });

  it('deve aplicar tom operacional para outros cargos', () => {
    const prompt = PromptBuilder.build(
      criarInput({
        contextoLead: {
          cargo: 'Analista',
          empresa: 'X',
          nicho: 'tech',
          estagio: 'novo'
        }
      })
    );
    expect(prompt).toContain(INSTRUCOES_TOM.OPERACIONAL);
  });
});

describe('Componente 5 - ComponenteGeracao.executar', () => {
  let store: Map<string, string>;
  let redisStub: Redis;
  let getSpy: ReturnType<typeof vi.fn>;
  let setSpy: ReturnType<typeof vi.fn>;
  let createSpy: ReturnType<typeof vi.fn>;
  let openaiStub: OpenAI;
  let componente: ComponenteGeracao;

  beforeEach(() => {
    store = new Map();
    getSpy = vi.fn((chave: string) =>
      Promise.resolve(store.get(chave) ?? null)
    );
    setSpy = vi.fn(
      (chave: string, valor: string) => {
        store.set(chave, valor);
        return Promise.resolve('OK');
      }
    );

    redisStub = { get: getSpy, set: setSpy } as unknown as Redis;

    createSpy = vi.fn(() =>
      Promise.resolve({
        choices: [
          {
            message: {
              content:
                'Entendo sua preocupação com o investimento. ' +
                'Considerando o ROI e os diferenciais, o custo se paga rápido. ' +
                'Podemos revisar os números juntos para encontrar a melhor opção?'
            }
          }
        ]
      })
    );

    openaiStub = {
      chat: { completions: { create: createSpy } }
    } as unknown as OpenAI;

    componente = new ComponenteGeracao(
      openaiStub,
      {} as Pool,
      redisStub
    );
  });

  it('deve gerar resposta via GPT quando não há cache', async () => {
    const resultado = await componente.executar(criarInput());

    expect(createSpy).toHaveBeenCalledOnce();
    expect(resultado.resposta.length).toBeGreaterThan(0);
    expect(resultado.confianca).toBeGreaterThan(0);
    expect(resultado.confianca).toBeLessThanOrEqual(1);
  });

  it('deve enviar a mensagem do lead como role user à IA', async () => {
    await componente.executar(criarInput());

    const args = createSpy.mock.calls[0][0];
    expect(args.messages[0]).toMatchObject({ role: 'system' });
    expect(args.messages).toContainEqual({
      role: 'user',
      content: 'Está acima do orçamento.'
    });
  });

  it('não deve adicionar mensagem user quando a objeção está vazia', async () => {
    await componente.executar(criarInput({ objecao: '   ' }));

    const args = createSpy.mock.calls[0][0];
    expect(args.messages).toHaveLength(1);
    expect(args.messages[0]).toMatchObject({ role: 'system' });
  });

  it('deve salvar no cache com TTL de 300s', async () => {
    await componente.executar(criarInput());

    const hash = Buffer.from('Está acima do orçamento.')
      .toString('base64')
      .slice(0, 16);
    expect(setSpy).toHaveBeenCalledWith(
      `gen:PRECO:Diretor Clínico:${hash}`,
      expect.any(String),
      'EX',
      300
    );
  });

  it('deve retornar do cache sem chamar GPT', async () => {
    const hash = Buffer.from('Está acima do orçamento.')
      .toString('base64')
      .slice(0, 16);
    store.set(
      `gen:PRECO:Diretor Clínico:${hash}`,
      JSON.stringify({ resposta: 'cacheada', confianca: 0.9 })
    );

    const resultado = await componente.executar(criarInput());

    expect(createSpy).not.toHaveBeenCalled();
    expect(resultado.resposta).toBe('cacheada');
    expect(resultado.confianca).toBe(0.9);
  });

  it('deve tratar conteúdo nulo do GPT como string vazia', async () => {
    createSpy.mockResolvedValueOnce({
      choices: [{ message: { content: null } }]
    });

    const resultado = await componente.executar(criarInput());
    expect(resultado.resposta).toBe('');
  });
});
