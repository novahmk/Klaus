/**
 * Testes de Cache - Componente 2: Gerador de Perguntas
 * Klaus V2
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GerenciadorCachePergunta } from './cache';

describe('Cache Redis - Testes de Integração', () => {
  let cache: GerenciadorCachePergunta;

  beforeEach(() => {
    cache = new GerenciadorCachePergunta();
  });

  afterEach(async () => {
    await cache.fechar();
  });

  describe('Operações (sem Redis real)', () => {
    it('deve retornar null quando cache não disponível', async () => {
      const resultado = await cache.obter('Vendas', 1, 'lead-123');
      expect(resultado).toBeNull();
    });

    it('deve retornar false ao armazenar sem Redis', async () => {
      const resultado = await cache.armazenar('Vendas', 1, 'lead-123', {
        pergunta: 'Qual é seu desafio?',
        contextoEsperado: 'Lead descrevendo',
        camada: 1,
        timestamp: new Date(),
        origem: 'template'
      });

      expect(resultado).toBe(false);
    });

    it('deve retornar null ao obter por tema sem Redis', async () => {
      const resultado = await cache.obterPorTema('Vendas', 'lead-123');
      expect(resultado).toBeNull();
    });

    it('deve reportar como indisponível sem Redis', () => {
      expect(cache.ehDisponivel()).toBe(false);
    });

    it('deve fechar sem erro', async () => {
      await expect(cache.fechar()).resolves.not.toThrow();
    });
  });
});
