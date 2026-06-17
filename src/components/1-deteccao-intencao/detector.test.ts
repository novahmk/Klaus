/**
 * Testes Unitários - Componente 1: Detecção de Intenção
 * Klaus V2
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DetectorIntencao, Intencao, DetectorInput } from './detector';
import { AnalisadorFallback } from './fallback';
import { ValidadorIntencao } from './validator';
import { GerenciadorCache } from './cache';

describe('Componente 1 - Detecção de Intenção', () => {
  let detector: DetectorIntencao;

  beforeEach(() => {
    detector = new DetectorIntencao({
      enableGpt: false, // Desabilitar GPT nos testes
      enableCache: false, // Desabilitar cache nos testes
      enableFallback: true
    });
  });

  afterEach(async () => {
    await detector.fechar();
  });

  describe('Validador de Intenção', () => {
    it('deve validar um resultado correto', () => {
      const resultado = {
        intencao: Intencao.QUER_AGENDAR,
        confianca: 85,
        motivo: 'Lead solicitou agendamento',
        timestamp: new Date(),
        origem: 'fallback'
      };

      const valido = ValidadorIntencao.validarResultado(resultado);
      expect(valido).toBe(true);
    });

    it('deve rejeitar resultado sem intencao', () => {
      const resultado = {
        confianca: 85,
        motivo: 'Teste',
        timestamp: new Date(),
        origem: 'fallback'
      };

      const valido = ValidadorIntencao.validarResultado(resultado);
      expect(valido).toBe(false);
    });

    it('deve rejeitar confiança fora do intervalo', () => {
      const resultado = {
        intencao: Intencao.QUER_AGENDAR,
        confianca: 150, // Inválido
        motivo: 'Teste',
        timestamp: new Date(),
        origem: 'fallback'
      };

      const valido = ValidadorIntencao.validarResultado(resultado);
      expect(valido).toBe(false);
    });

    it('deve normalizar confiança corretamente', () => {
      expect(ValidadorIntencao.normalizarConfianca(150)).toBe(100);
      expect(ValidadorIntencao.normalizarConfianca(-10)).toBe(0);
      expect(ValidadorIntencao.normalizarConfianca(50)).toBe(50);
    });

    it('deve validar entrada do detector', () => {
      const { valido, erro } = ValidadorIntencao.validarEntrada('Quero agendar');
      expect(valido).toBe(true);
      expect(erro).toBeUndefined();
    });

    it('deve rejeitar entrada vazia', () => {
      const { valido, erro } = ValidadorIntencao.validarEntrada('');
      expect(valido).toBe(false);
      expect(erro).toBeDefined();
    });

    it('deve rejeitar entrada muito longa', () => {
      const mensagemGrande = 'a'.repeat(15000);
      const { valido, erro } = ValidadorIntencao.validarEntrada(mensagemGrande);
      expect(valido).toBe(false);
      expect(erro).toBeDefined();
    });

    it('deve validar resposta JSON do GPT', () => {
      const respostaValida = JSON.stringify({
        intencao: 'QUER_AGENDAR',
        confianca: 95,
        motivo: 'Teste'
      });

      const resultado = ValidadorIntencao.validarRespostaGpt(respostaValida);
      expect(resultado.valido).toBe(true);
      expect(resultado.dados?.intencao).toBe('QUER_AGENDAR');
    });

    it('deve rejeitar JSON inválido', () => {
      const resultado = ValidadorIntencao.validarRespostaGpt('JSON inválido {');
      expect(resultado.valido).toBe(false);
      expect(resultado.erro).toBeDefined();
    });
  });

  describe('Analisador Fallback', () => {
    it('deve detectar QUER_AGENDAR', () => {
      const resultado = AnalisadorFallback.analisar('Gostaria de agendar uma reunião');
      expect(resultado).not.toBeNull();
      expect(resultado?.intencao).toBe(Intencao.QUER_AGENDAR);
      expect(resultado?.confianca).toBeGreaterThan(50);
    });

    it('deve detectar QUER_MAIS_INFO', () => {
      const resultado = AnalisadorFallback.analisar('Pode enviar mais informações?');
      expect(resultado).not.toBeNull();
      expect(resultado?.intencao).toBe(Intencao.QUER_MAIS_INFO);
      expect(resultado?.confianca).toBeGreaterThan(50);
    });

    it('deve detectar TEM_OBJECAO', () => {
      const resultado = AnalisadorFallback.analisar('Mas o preço é muito alto');
      expect(resultado).not.toBeNull();
      expect(resultado?.intencao).toBe(Intencao.TEM_OBJECAO);
      expect(resultado?.confianca).toBeGreaterThan(50);
    });

    it('deve detectar DEMONSTRA_INTERESSE', () => {
      const resultado = AnalisadorFallback.analisar('Achei muito interessante!');
      expect(resultado).not.toBeNull();
      expect(resultado?.intencao).toBe(Intencao.DEMONSTRA_INTERESSE);
      expect(resultado?.confianca).toBeGreaterThan(50);
    });

    it('deve detectar NAO_INTERESSADO', () => {
      const resultado = AnalisadorFallback.analisar('Não tenho interesse');
      expect(resultado).not.toBeNull();
      expect(resultado?.intencao).toBe(Intencao.NAO_INTERESSADO);
      expect(resultado?.confianca).toBeGreaterThan(50);
    });

    it('deve detectar NAO_RESPONDEU para respostas muito vagas', () => {
      const resultado = AnalisadorFallback.analisar('ok');
      expect(resultado).not.toBeNull();
      expect(resultado?.intencao).toBe(Intencao.NAO_RESPONDEU);
    });

    it('deve considerar histórico na análise', () => {
      const historico = [
        { papel: 'lead', conteudo: 'Oi', timestamp: new Date() },
        { papel: 'sistema', conteudo: 'Olá! Como posso ajudar?', timestamp: new Date() },
        { papel: 'lead', conteudo: 'Quero saber mais', timestamp: new Date() }
      ];

      const resultado = AnalisadorFallback.analisar('Quero agendar', historico);
      expect(resultado).not.toBeNull();
      expect(resultado?.intencao).toBe(Intencao.QUER_AGENDAR);
    });
  });

  describe('Detector Principal', () => {
    it('deve detectar intenção corretamente', async () => {
      const input: DetectorInput = {
        mensagem: 'Gostaria de agendar uma reunião'
      };

      const resultado = await detector.detectar(input);
      expect(resultado).not.toBeNull();
      expect(resultado.intencao).toBe(Intencao.QUER_AGENDAR);
      expect(resultado.confianca).toBeGreaterThan(0);
      expect(resultado.timestamp).toBeInstanceOf(Date);
      expect(resultado.origem).toBeDefined();
    });

    it('deve retornar NAO_RESPONDEU para entrada inválida', async () => {
      const input: DetectorInput = {
        mensagem: ''
      };

      const resultado = await detector.detectar(input);
      expect(resultado.intencao).toBe(Intencao.NAO_RESPONDEU);
      expect(resultado.confianca).toBe(0);
    });

    it('deve processar historico', async () => {
      const input: DetectorInput = {
        mensagem: 'Agendar',
        historico: [
          { papel: 'lead', conteudo: 'Olá', timestamp: new Date() },
          { papel: 'sistema', conteudo: 'Oi! Posso ajudar?', timestamp: new Date() }
        ]
      };

      const resultado = await detector.detectar(input);
      expect(resultado).not.toBeNull();
      expect(resultado.timestamp).toBeInstanceOf(Date);
    });

    it('deve processar contexto', async () => {
      const input: DetectorInput = {
        mensagem: 'Ótimo produto!',
        contexto: {
          leadId: 'lead-123',
          empresa: 'Tech Corp',
          segmento: 'SaaS'
        }
      };

      const resultado = await detector.detectar(input);
      expect(resultado).not.toBeNull();
      expect(resultado.intencao).toBe(Intencao.DEMONSTRA_INTERESSE);
    });

    it('deve ter tratamento de erro', async () => {
      const input: DetectorInput = {
        mensagem: 'Teste',
        historico: [
          // Histórico inválido será tratado
        ] as any
      };

      const resultado = await detector.detectar(input);
      expect(resultado).not.toBeNull();
      expect(resultado.intencao).toBeDefined();
    });

    it('deve gerar motivo descritivo', async () => {
      const input: DetectorInput = {
        mensagem: 'Posso ter mais informações?'
      };

      const resultado = await detector.detectar(input);
      expect(resultado.motivo).toBeDefined();
      expect(resultado.motivo.length).toBeGreaterThan(0);
    });

    it('deve retornar timestamp válido', async () => {
      const input: DetectorInput = {
        mensagem: 'Teste'
      };

      const resultado = await detector.detectar(input);
      expect(resultado.timestamp).toBeInstanceOf(Date);
      expect(resultado.timestamp.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('deve especificar origem da análise', async () => {
      const input: DetectorInput = {
        mensagem: 'Quero agendar'
      };

      const resultado = await detector.detectar(input);
      expect(['gpt', 'fallback', 'cache']).toContain(resultado.origem);
    });
  });

  describe('Gerenciador de Cache', () => {
    it('deve retornar null quando cache desativado', async () => {
      const cache = new GerenciadorCache();
      const resultado = await cache.obter('teste');
      expect(resultado).toBeNull();
    });

    it('deve retornar disponivel como false sem Redis', () => {
      const cache = new GerenciadorCache();
      expect(cache.ehDisponivel()).toBe(false);
    });

    it('deve fechar sem erro', async () => {
      const cache = new GerenciadorCache();
      await expect(cache.fechar()).resolves.not.toThrow();
    });
  });

  describe('Casos de Borda', () => {
    it('deve lidar com mensagem com caracteres especiais', async () => {
      const input: DetectorInput = {
        mensagem: 'Quer @# $%& agendar?'
      };

      const resultado = await detector.detectar(input);
      expect(resultado).not.toBeNull();
      expect(resultado.intencao).toBeDefined();
    });

    it('deve lidar com mensagem muito longa', async () => {
      const input: DetectorInput = {
        mensagem: 'Teste '.repeat(100)
      };

      const resultado = await detector.detectar(input);
      expect(resultado).not.toBeNull();
    });

    it('deve lidar com Unicode/emojis', async () => {
      const input: DetectorInput = {
        mensagem: 'Adorei! 😍 Quero agendar! 🎉'
      };

      const resultado = await detector.detectar(input);
      expect(resultado).not.toBeNull();
      expect([Intencao.DEMONSTRA_INTERESSE, Intencao.QUER_AGENDAR]).toContain(resultado.intencao);
    });

    it('deve normalizar entrada case-insensitive', async () => {
      const input1: DetectorInput = { mensagem: 'QUERO AGENDAR' };
      const input2: DetectorInput = { mensagem: 'quero agendar' };

      const resultado1 = await detector.detectar(input1);
      const resultado2 = await detector.detectar(input2);

      expect(resultado1.intencao).toBe(resultado2.intencao);
    });
  });
});

describe('Integração - Fluxo Completo', () => {
  it('deve processar fluxo de conversa completa', async () => {
    const detector = new DetectorIntencao({
      enableGpt: false,
      enableCache: false,
      enableFallback: true
    });

    const historico = [
      { papel: 'sistema', conteudo: 'Olá! Como posso ajudar?', timestamp: new Date() },
      { papel: 'lead', conteudo: 'Oi, tudo bem?', timestamp: new Date() }
    ];

    // Mensagem 1
    let resultado = await detector.detectar({
      mensagem: 'Oi, tudo bem?',
      historico
    });
    expect(resultado.intencao).toBe(Intencao.NAO_RESPONDEU);

    // Mensagem 2
    resultado = await detector.detectar({
      mensagem: 'Quero saber mais sobre o produto',
      historico: [
        ...historico,
        { papel: 'lead', conteudo: 'Oi, tudo bem?', timestamp: new Date() }
      ]
    });
    expect(resultado.intencao).toBe(Intencao.QUER_MAIS_INFO);

    // Mensagem 3
    resultado = await detector.detectar({
      mensagem: 'Parece interessante, posso agendar uma demo?',
      historico: []
    });
    expect([Intencao.QUER_AGENDAR, Intencao.DEMONSTRA_INTERESSE]).toContain(resultado.intencao);

    await detector.fechar();
  });
});
