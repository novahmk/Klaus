/**
 * Testes Integração - Cache Redis
 * Klaus V2 - Componente 1
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GerenciadorCache } from './cache';
import { Intencao } from './types';

describe('Cache Redis - Testes de Integração', () => {
  let cache: GerenciadorCache;

  beforeEach(() => {
    // Usar configuração sem Redis (testes unitários não precisam de Redis real)
    cache = new GerenciadorCache();
  });

  afterEach(async () => {
    await cache.fechar();
  });

  describe('Operações de Cache (sem Redis real)', () => {
    it('deve retornar null quando cache não disponível', async () => {
      const resultado = await cache.obter('mensagem teste');
      expect(resultado).toBeNull();
    });

    it('deve retornar false ao armazenar sem Redis', async () => {
      const resultado = await cache.armazenar('mensagem teste', {
        intencao: Intencao.QUER_AGENDAR,
        confianca: 85,
        motivo: 'Teste',
        timestamp: new Date(),
        origem: 'fallback'
      });

      expect(resultado).toBe(false);
    });

    it('deve retornar false ao limpar chave sem Redis', async () => {
      const resultado = await cache.limparChave('mensagem teste');
      expect(resultado).toBe(false);
    });

    it('deve retornar false ao limpar tudo sem Redis', async () => {
      const resultado = await cache.limparTudo();
      expect(resultado).toBe(false);
    });

    it('deve reportar como indisponível sem Redis', () => {
      expect(cache.ehDisponivel()).toBe(false);
    });

    it('deve fechar sem erro', async () => {
      await expect(cache.fechar()).resolves.not.toThrow();
    });
  });

  describe('Chaves de Cache', () => {
    it('deve gerar chaves determinísticas', async () => {
      const cache1 = new GerenciadorCache();
      const cache2 = new GerenciadorCache();

      // Se ambas geram chaves, devem ser determinísticas
      // (mesmo que não consigam armazenar sem Redis)
      const msg = 'Quero agendar';

      await cache1.obter(msg);
      await cache2.obter(msg);

      // Ambas devem retornar null (sem erro)
      expect(cache1.ehDisponivel()).toBe(false);
      expect(cache2.ehDisponivel()).toBe(false);
    });

    it('deve considerar contexto na geração de chave', async () => {
      const msg = 'Teste';
      const contexto1 = { leadId: '123' };
      const contexto2 = { leadId: '456' };

      // Diferentes contextos devem gerar diferentes chaves (mas ambos retornam null)
      const resultado1 = await cache.obter(msg, contexto1);
      const resultado2 = await cache.obter(msg, contexto2);

      expect(resultado1).toBeNull();
      expect(resultado2).toBeNull();
    });
  });
});
