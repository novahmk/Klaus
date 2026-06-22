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

// Mock obterConfigIA para retornar defaults sem chamar Supabase
vi.mock('../../modules/ia-config-loader/loader', () => ({
  obterConfigIA: vi.fn().mockResolvedValue({
    cliente_id: 'cliente-1',
    parametros: { max_tokens: 200, temperature: 0.4, model: 'gpt-4o-mini' },
    validacao: { min_length: 150, max_length: 500, min_score: 70, max_retries: 3 },
    tom_voz: {
      tom_geral: 'profissional',
      tom_executivo: 'Foco em ROI, visão estratégica e resultados de alto nível. Linguagem direta.',
      tom_tecnico: 'Foco em especificações, integração e performance. Linguagem precisa.',
      tom_suporte: 'Foco em facilidade de uso, implementação e dia a dia. Linguagem prática.'
    },
    regras: {
      regras: ['Não invente dados.', 'Seja empático.'],
      palavras_chave_bloqueadas: ['infelizmente'],
      palavras_chave_obrigatorias: []
    },
    disparos: { intervalo_min_segundos: 3600, intervalo_max_segundos: 7200, limite_diario: 50 },
    aprendizado: { ativo: false, metricas_habilitadas: false },
    ultima_atualizacao: new Date().toISOString()
  })
}));

// Mock obterSystemPrompt para não depender de cache externo
vi.mock('../../modules/config-loader/prompt-builder', () => ({
  obterSystemPrompt: vi.fn().mockReturnValue('')
}));



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

  it('deve salvar no cache com TTL de 3600s', async () => {
    await componente.executar(criarInput());

    expect(setSpy).toHaveBeenCalledWith(
      'gen:PRECO:Diretor Clínico',
      expect.any(String),
      'EX',
      3600
    );
  });

  it('deve retornar do cache sem chamar GPT', async () => {
    store.set(
      'gen:PRECO:Diretor Clínico',
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

describe('Componente 5 - ValidadorResposta com ConfigIAValidacao dinâmica', () => {
  const configCustom = {
    min_length: 50,
    max_length: 200,
    min_score: 60,
    max_retries: 5
  };

  it('deve usar min_length da config dinâmica', () => {
    // Resposta com 60 chars — acima do min_length=50, abaixo do padrão 150
    const resposta = 'Entendo sua preocupação. Podemos encontrar uma solução?';
    expect(resposta.length).toBeGreaterThanOrEqual(50);
    // Com config dinâmica (min=50): não penaliza por tamanho
    expect(ValidadorResposta.validar(resposta, configCustom)).toBe(100);
    // Sem config (min=150): penaliza por tamanho
    expect(ValidadorResposta.validar(resposta)).toBe(70);
  });

  it('deve usar max_length da config dinâmica para truncar', () => {
    const resposta = 'A'.repeat(300);
    const truncada = ValidadorResposta.truncar(resposta, configCustom);
    expect(truncada.length).toBeLessThanOrEqual(200);
  });

  it('truncar sem config usa DEFAULT_VALIDACAO.max_length (500)', () => {
    const resposta = 'A'.repeat(600);
    const truncada = ValidadorResposta.truncar(resposta);
    expect(truncada.length).toBeLessThanOrEqual(500);
  });
});

describe('Componente 5 - PromptBuilder com ConfigIA dinâmica', () => {
  const configIA = {
    cliente_id: 'cliente-test',
    parametros: { max_tokens: 200, temperature: 0.4, model: 'gpt-4o-mini' },
    validacao: { min_length: 150, max_length: 500, min_score: 70, max_retries: 3 },
    tom_voz: {
      tom_geral: 'consultivo',
      tom_executivo: 'Tom executivo customizado.',
      tom_tecnico: 'Tom técnico customizado.',
      tom_suporte: 'Tom suporte customizado.'
    },
    regras: {
      regras: ['Regra dinâmica 1.', 'Regra dinâmica 2.'],
      palavras_chave_bloqueadas: ['nunca'],
      palavras_chave_obrigatorias: ['sempre']
    },
    disparos: { intervalo_min_segundos: 3600, intervalo_max_segundos: 7200, limite_diario: 50 },
    aprendizado: { ativo: false, metricas_habilitadas: false },
    ultima_atualizacao: new Date().toISOString()
  };

  it('deve usar tom_executivo da ConfigIA para CEO', () => {
    const prompt = PromptBuilder.build(
      criarInput({ contextoLead: { cargo: 'CEO', empresa: 'X', nicho: 'tech', estagio: 'novo' } }),
      configIA
    );
    expect(prompt).toContain('Tom executivo customizado.');
  });

  it('deve usar tom_tecnico da ConfigIA para CTO', () => {
    const prompt = PromptBuilder.build(
      criarInput({ contextoLead: { cargo: 'CTO', empresa: 'X', nicho: 'tech', estagio: 'novo' } }),
      configIA
    );
    expect(prompt).toContain('Tom técnico customizado.');
  });

  it('deve injetar regras dinâmicas no prompt', () => {
    const prompt = PromptBuilder.build(criarInput(), configIA);
    expect(prompt).toContain('Regra dinâmica 1.');
    expect(prompt).toContain('Regra dinâmica 2.');
  });

  it('deve injetar palavras bloqueadas no prompt', () => {
    const prompt = PromptBuilder.build(criarInput(), configIA);
    expect(prompt).toContain('nunca');
  });

  it('deve injetar palavras obrigatórias no prompt', () => {
    const prompt = PromptBuilder.build(criarInput(), configIA);
    expect(prompt).toContain('sempre');
  });

  it('sem ConfigIA usa fallback baseado em cargo', () => {
    const prompt = PromptBuilder.build(
      criarInput({ contextoLead: { cargo: 'CEO', empresa: 'X', nicho: 'tech', estagio: 'novo' } })
    );
    expect(prompt).toContain(INSTRUCOES_TOM.EXECUTIVO);
  });
});
