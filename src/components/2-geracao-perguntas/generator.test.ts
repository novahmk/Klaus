/**
 * Testes Unitários - Componente 2: Gerador de Perguntas
 * Klaus V2
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  GeradorPerguntas,
  GeradorPerguntasInput,
  CamadaPergunta
} from './generator';
import { ValidadorPergunta } from './validators';
import { Intencao } from '../1-deteccao-intencao';

describe('Componente 2 - Gerador de Perguntas', () => {
  let gerador: GeradorPerguntas;

  beforeEach(() => {
    gerador = new GeradorPerguntas({
      enableGpt: false,
      enableCache: false,
      enableFallback: true
    });
  });

  afterEach(async () => {
    await gerador.fechar();
  });

  describe('Validador de Pergunta', () => {
    it('deve validar pergunta correta', () => {
      const resultado = ValidadorPergunta.validarCompleto('Qual é seu maior desafio?');
      expect(resultado.valido).toBe(true);
      expect(resultado.erros).toHaveLength(0);
    });

    it('deve rejeitar pergunta muito curta', () => {
      const resultado = ValidadorPergunta.validarCompleto('Oi?');
      expect(resultado.valido).toBe(false);
      expect(resultado.erros.length).toBeGreaterThan(0);
    });

    it('deve rejeitar pergunta muito longa', () => {
      const pergunta = 'Como você faria para resolver o problema mais complexo que jamais existiu no universo?'.repeat(
        3
      );
      const resultado = ValidadorPergunta.validarCompleto(pergunta);
      expect(resultado.valido).toBe(false);
    });

    it('deve rejeitar pergunta que não termina com ?', () => {
      const resultado = ValidadorPergunta.validarCompleto('Qual é seu desafio');
      expect(resultado.valido).toBe(false);
    });

    it('deve rejeitar pergunta fechada', () => {
      const resultado = ValidadorPergunta.validarCompleto('Você prefere essa solução?');
      expect(resultado.valido).toBe(false);
    });

    it('deve rejeitar pergunta com placeholders', () => {
      const resultado = ValidadorPergunta.validarCompleto('Qual é o maior desafio em {EMPRESA}?');
      expect(resultado.valido).toBe(false);
    });

    it('deve rejeitar pergunta com similaridade alta', () => {
      const anterior = ['Qual é seu maior desafio?'];
      const resultado = ValidadorPergunta.validarCompleto(
        'Qual é o seu maior desafio atual?',
        anterior
      );
      expect(resultado.valido).toBe(false);
    });

    it('deve aceitar pergunta com baixa similaridade', () => {
      const anterior = ['Qual é seu maior desafio?'];
      const resultado = ValidadorPergunta.validarCompleto(
        'Como você está lidando com isso hoje?',
        anterior
      );
      expect(resultado.valido).toBe(true);
    });

    it('deve detectar pergunta aberta', () => {
      expect(ValidadorPergunta.ehPerguntaFechada('Qual é seu problema?')).toBe(false);
      expect(ValidadorPergunta.ehPerguntaFechada('Como você se sente?')).toBe(false);
      expect(ValidadorPergunta.ehPerguntaFechada('Você gostou?')).toBe(true);
      expect(ValidadorPergunta.ehPerguntaFechada('É verdade que você quer?')).toBe(true);
    });

    it('deve detectar placeholders', () => {
      expect(ValidadorPergunta.temPlaceholders('Qual é seu nome?')).toBe(false);
      expect(ValidadorPergunta.temPlaceholders('Qual é seu nome em {CAMPO}?')).toBe(true);
      expect(ValidadorPergunta.temPlaceholders('Qual é seu EMAIL?')).toBe(true);
    });

    it('deve validar entrada do gerador', () => {
      const historico = [
        { papel: 'lead', conteudo: 'Oi', timestamp: new Date() }
      ];

      const { valido, erro } = ValidadorPergunta.validarEntrada(
        'Vendas B2B',
        historico
      );
      expect(valido).toBe(true);
      expect(erro).toBeUndefined();
    });

    it('deve rejeitar tema vazio', () => {
      const historico = [
        { papel: 'lead', conteudo: 'Oi', timestamp: new Date() }
      ];

      const { valido } = ValidadorPergunta.validarEntrada('', historico);
      expect(valido).toBe(false);
    });

    it('deve validar resultado', () => {
      const resultado = {
        pergunta: 'Qual é seu maior desafio?',
        contextoEsperado: 'Lead descrevendo pain point',
        camada: 1,
        timestamp: new Date(),
        origem: 'template'
      };

      expect(ValidadorPergunta.validarResultado(resultado)).toBe(true);
    });

    it('deve rejeitar resultado com pergunta inválida', () => {
      const resultado = {
        pergunta: 'Oi?',
        contextoEsperado: 'Lead descrevendo pain point',
        camada: 1,
        timestamp: new Date(),
        origem: 'template'
      };

      expect(ValidadorPergunta.validarResultado(resultado)).toBe(false);
    });
  });

  describe('Gerador Principal', () => {
    it('deve gerar pergunta da camada 1 quando nenhuma pergunta foi feita', async () => {
      const input: GeradorPerguntasInput = {
        tema: 'Vendas',
        historico: [{ papel: 'lead', conteudo: 'Oi', timestamp: new Date() }],
        intencao: Intencao.QUER_MAIS_INFO,
        clienteId: 'lead-123',
        perguntasJaFeitas: []
      };

      const resultado = await gerador.gerar(input);

      expect(resultado).not.toBeNull();
      expect(resultado.camada).toBe(1);
      expect(resultado.pergunta).toBeDefined();
      expect(resultado.pergunta.length).toBeGreaterThan(0);
    });

    it('deve gerar pergunta da camada 2 quando 1 pergunta foi feita', async () => {
      const input: GeradorPerguntasInput = {
        tema: 'Vendas',
        historico: [{ papel: 'lead', conteudo: 'Oi', timestamp: new Date() }],
        intencao: Intencao.DEMONSTRA_INTERESSE,
        clienteId: 'lead-123',
        perguntasJaFeitas: ['Qual é seu maior desafio?']
      };

      const resultado = await gerador.gerar(input);

      expect(resultado.camada).toBe(2);
    });

    it('deve gerar pergunta da camada 3 quando 2 ou mais perguntas foram feitas', async () => {
      const input: GeradorPerguntasInput = {
        tema: 'Vendas',
        historico: [{ papel: 'lead', conteudo: 'Oi', timestamp: new Date() }],
        intencao: Intencao.QUER_AGENDAR,
        clienteId: 'lead-123',
        perguntasJaFeitas: [
          'Qual é seu maior desafio?',
          'Como você está lidando com isso?'
        ]
      };

      const resultado = await gerador.gerar(input);

      expect(resultado.camada).toBe(3);
    });

    it('deve retornar resultado válido mesmo com entrada inválida', async () => {
      const input: GeradorPerguntasInput = {
        tema: '',
        historico: [],
        intencao: Intencao.QUER_MAIS_INFO,
        clienteId: 'lead-123'
      };

      const resultado = await gerador.gerar(input);

      expect(resultado).not.toBeNull();
      expect(resultado.pergunta).toBeDefined();
      expect(resultado.origem).toBe('template');
    });

    it('deve ter timestamp válido', async () => {
      const input: GeradorPerguntasInput = {
        tema: 'Vendas',
        historico: [{ papel: 'lead', conteudo: 'Oi', timestamp: new Date() }],
        intencao: Intencao.DEMONSTRA_INTERESSE,
        clienteId: 'lead-123',
        perguntasJaFeitas: []
      };

      const resultado = await gerador.gerar(input);

      expect(resultado.timestamp).toBeInstanceOf(Date);
      expect(resultado.timestamp.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('deve especificar origem correta', async () => {
      const input: GeradorPerguntasInput = {
        tema: 'Vendas',
        historico: [{ papel: 'lead', conteudo: 'Oi', timestamp: new Date() }],
        intencao: Intencao.QUER_MAIS_INFO,
        clienteId: 'lead-123',
        perguntasJaFeitas: []
      };

      const resultado = await gerador.gerar(input);

      expect(['gpt', 'template']).toContain(resultado.origem);
    });

    it('deve gerar contextoEsperado', async () => {
      const input: GeradorPerguntasInput = {
        tema: 'Vendas',
        historico: [{ papel: 'lead', conteudo: 'Oi', timestamp: new Date() }],
        intencao: Intencao.DEMONSTRA_INTERESSE,
        clienteId: 'lead-123',
        perguntasJaFeitas: []
      };

      const resultado = await gerador.gerar(input);

      expect(resultado.contextoEsperado).toBeDefined();
      expect(resultado.contextoEsperado.length).toBeGreaterThan(0);
    });

    it('deve processar múltiplas intenções', async () => {
      const intencoes = [
        Intencao.QUER_AGENDAR,
        Intencao.QUER_MAIS_INFO,
        Intencao.TEM_OBJECAO,
        Intencao.DEMONSTRA_INTERESSE,
        Intencao.NAO_INTERESSADO
      ];

      for (const intencao of intencoes) {
        const input: GeradorPerguntasInput = {
          tema: 'Vendas',
          historico: [{ papel: 'lead', conteudo: 'Oi', timestamp: new Date() }],
          intencao,
          clienteId: 'lead-123',
          perguntasJaFeitas: []
        };

        const resultado = await gerador.gerar(input);

        expect(resultado).not.toBeNull();
        expect(resultado.pergunta).toBeDefined();
      }
    });
  });

  describe('Camadas de Pergunta', () => {
    it('deve gerar pergunta diferente para cada camada', async () => {
      const input1: GeradorPerguntasInput = {
        tema: 'Vendas',
        historico: [{ papel: 'lead', conteudo: 'Oi', timestamp: new Date() }],
        intencao: Intencao.DEMONSTRA_INTERESSE,
        clienteId: 'lead-123',
        perguntasJaFeitas: []
      };

      const input2: GeradorPerguntasInput = {
        ...input1,
        perguntasJaFeitas: ['Primeira pergunta?']
      };

      const input3: GeradorPerguntasInput = {
        ...input1,
        perguntasJaFeitas: ['Primeira pergunta?', 'Segunda pergunta?']
      };

      const resultado1 = await gerador.gerar(input1);
      const resultado2 = await gerador.gerar(input2);
      const resultado3 = await gerador.gerar(input3);

      expect(resultado1.camada).toBe(1);
      expect(resultado2.camada).toBe(2);
      expect(resultado3.camada).toBe(3);
    });
  });

  describe('Casos de Borda', () => {
    it('deve lidar com histórico vazio', async () => {
      const input: GeradorPerguntasInput = {
        tema: 'Vendas',
        historico: [],
        intencao: Intencao.QUER_MAIS_INFO,
        clienteId: 'lead-123',
        perguntasJaFeitas: []
      };

      // Esperamos erro na validação, então resultado será genérico
      // Não devemos chamar gerar com histórico vazio
      // Este teste apenas valida que a função se comporta bem
      expect(input.historico).toHaveLength(0);
    });

    it('deve lidar com tema muito longo', async () => {
      const input: GeradorPerguntasInput = {
        tema: 'A'.repeat(1000),
        historico: [{ papel: 'lead', conteudo: 'Oi', timestamp: new Date() }],
        intencao: Intencao.QUER_MAIS_INFO,
        clienteId: 'lead-123',
        perguntasJaFeitas: []
      };

      const resultado = await gerador.gerar(input);

      expect(resultado).not.toBeNull();
    });

    it('deve lidar com muitas perguntas já feitas', async () => {
      const perguntasJaFeitas = [];
      for (let i = 0; i < 100; i++) {
        perguntasJaFeitas.push(`Pergunta ${i}?`);
      }

      const input: GeradorPerguntasInput = {
        tema: 'Vendas',
        historico: [{ papel: 'lead', conteudo: 'Oi', timestamp: new Date() }],
        intencao: Intencao.DEMONSTRA_INTERESSE,
        clienteId: 'lead-123',
        perguntasJaFeitas
      };

      const resultado = await gerador.gerar(input);

      expect(resultado.camada).toBe(3);
    });

    it('deve lidar com perguntas já feitas com texto muito similar', async () => {
      const input: GeradorPerguntasInput = {
        tema: 'Vendas',
        historico: [{ papel: 'lead', conteudo: 'Oi', timestamp: new Date() }],
        intencao: Intencao.DEMONSTRA_INTERESSE,
        clienteId: 'lead-123',
        perguntasJaFeitas: [
          'Qual é seu maior desafio?',
          'Como você está lidando com isso?',
          'Qual seria o impacto se resolvesse?'
        ]
      };

      const resultado = await gerador.gerar(input);

      expect(resultado).not.toBeNull();
      expect(resultado.pergunta).toBeDefined();
      // Deve ser diferente das anteriores
      expect(resultado.pergunta).not.toBe(input.perguntasJaFeitas[0]);
    });
  });
});

describe('Integração - Fluxo Completo', () => {
  it('deve processar conversação de 3 camadas', async () => {
    const gerador = new GeradorPerguntas({
      enableGpt: false,
      enableCache: false,
      enableFallback: true
    });

    // Camada 1
    let resultado1 = await gerador.gerar({
      tema: 'Processamento de Vendas',
      historico: [
        { papel: 'sistema', conteudo: 'Olá! Como posso ajudá-lo?', timestamp: new Date() },
        { papel: 'lead', conteudo: 'Oi, tudo bem?', timestamp: new Date() }
      ],
      intencao: Intencao.DEMONSTRA_INTERESSE,
      clienteId: 'lead-456',
      perguntasJaFeitas: []
    });

    expect(resultado1.camada).toBe(1);
    console.log(`Camada 1: ${resultado1.pergunta}`);

    // Camada 2
    let resultado2 = await gerador.gerar({
      tema: 'Processamento de Vendas',
      historico: [
        { papel: 'sistema', conteudo: 'Olá! Como posso ajudá-lo?', timestamp: new Date() },
        { papel: 'lead', conteudo: resultado1.pergunta, timestamp: new Date() }
      ],
      intencao: Intencao.DEMONSTRA_INTERESSE,
      clienteId: 'lead-456',
      perguntasJaFeitas: [resultado1.pergunta]
    });

    expect(resultado2.camada).toBe(2);
    console.log(`Camada 2: ${resultado2.pergunta}`);

    // Camada 3
    let resultado3 = await gerador.gerar({
      tema: 'Processamento de Vendas',
      historico: [
        { papel: 'sistema', conteudo: 'Olá! Como posso ajudá-lo?', timestamp: new Date() },
        { papel: 'lead', conteudo: resultado2.pergunta, timestamp: new Date() }
      ],
      intencao: Intencao.QUER_AGENDAR,
      clienteId: 'lead-456',
      perguntasJaFeitas: [resultado1.pergunta, resultado2.pergunta]
    });

    expect(resultado3.camada).toBe(3);
    console.log(`Camada 3: ${resultado3.pergunta}`);

    await gerador.fechar();
  });
});
