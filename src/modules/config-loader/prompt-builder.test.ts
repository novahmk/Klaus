// src/modules/config-loader/prompt-builder.test.ts
/**
 * Testes - Prompt Builder (Sprint 1/3)
 * Klaus V2
 *
 * Cobrem o mapeamento de campos após o alinhamento com o schema real do
 * Supabase (cfg_ia_*): cargo_alvo migrado para contexto, objetivo sem
 * "descricao" (usa objetivo_longo), abordagens como 3 textos fixos, merge
 * de palavras_chave_bloqueadas (regras + contexto), e a REGRA_FORMATO
 * sempre presente (fallback null e config completa/parcial).
 */

import { describe, it, expect } from 'vitest';
import { construirSystemPrompt } from './prompt-builder';
import { DashboardConfig } from './types';

function criarConfig(overrides: Partial<DashboardConfig> = {}): DashboardConfig {
  return {
    cliente_id: 'cliente-1',
    persona: { nome: 'Klaus', descricao: 'Especialista em transplante capilar' },
    objetivo: { objetivo_curto: 'Agendar avaliação', objetivo_longo: 'Converter o lead em consulta presencial' },
    abordagens: {
      abordagem_inicial: 'Acolher com empatia',
      abordagem_objecao: 'Rebater com dados de ROI',
      abordagem_fechamento: 'Convidar para agendar avaliação'
    },
    contexto: {
      cargo_alvo: 'paciente interessado em transplante capilar',
      palavras_chave_bloqueadas: ['garantia'],
      base_conhecimento: 'Técnica FUE, recuperação em 7 dias'
    },
    tom_voz: { tom_geral: 'acolhedor' },
    regras: {
      regras: ['Nunca prometer resultado exato'],
      palavras_chave_obrigatorias: ['Klaus'],
      palavras_chave_bloqueadas: ['barato']
    },
    ultima_atualizacao: new Date().toISOString(),
    ...overrides
  };
}

describe('PromptBuilder - construirSystemPrompt', () => {
  it('inclui nome/descrição da persona', () => {
    const prompt = construirSystemPrompt(criarConfig());
    expect(prompt).toContain('Você é Klaus.');
    expect(prompt).toContain('Especialista em transplante capilar');
  });

  it('usa contexto.cargo_alvo (não mais persona.cargo_alvo)', () => {
    const prompt = construirSystemPrompt(criarConfig());
    expect(prompt).toContain('paciente interessado em transplante capilar');
  });

  it('usa objetivo_longo no lugar da antiga coluna "descricao"', () => {
    const prompt = construirSystemPrompt(
      criarConfig({ objetivo: { objetivo_curto: 'Agendar', objetivo_longo: 'Converter o lead em consulta' } })
    );
    expect(prompt).toContain('Objetivo: Converter o lead em consulta');
  });

  it('renderiza as 3 linhas fixas de abordagens', () => {
    const prompt = construirSystemPrompt(criarConfig());
    expect(prompt).toContain('Abordagem inicial: Acolher com empatia');
    expect(prompt).toContain('Ao lidar com objeções: Rebater com dados de ROI');
    expect(prompt).toContain('Para fechar: Convidar para agendar avaliação');
  });

  it('combina palavras_chave_bloqueadas de regras e contexto sem duplicar', () => {
    const prompt = construirSystemPrompt(
      criarConfig({
        contexto: { cargo_alvo: 'paciente', palavras_chave_bloqueadas: ['garantia', 'barato'] },
        regras: { regras: [], palavras_chave_obrigatorias: [], palavras_chave_bloqueadas: ['barato', 'milagre'] }
      })
    );
    const linha = prompt.split('\n').find((l) => l.startsWith('NUNCA use estas palavras'));
    expect(linha).toBeDefined();
    expect(linha).toContain('garantia');
    expect(linha).toContain('barato');
    expect(linha).toContain('milagre');
    // "barato" aparecia nas duas listas — não deve repetir
    expect(linha?.match(/barato/g)?.length).toBe(1);
  });

  it('inclui base_conhecimento truncada quando muito grande', () => {
    const grande = 'x'.repeat(2000);
    const prompt = construirSystemPrompt(
      criarConfig({ contexto: { cargo_alvo: 'paciente', base_conhecimento: grande } })
    );
    expect(prompt).toContain('Base de conhecimento:');
    expect(prompt).not.toContain(grande);
    expect(prompt).toContain(`${'x'.repeat(1500)}...`);
  });

  it('inclui REGRA_FORMATO mesmo com config completa', () => {
    const prompt = construirSystemPrompt(criarConfig());
    expect(prompt).toContain('FORMATO DE RESPOSTA');
  });

  it('inclui REGRA_FORMATO mesmo com config parcial (só persona)', () => {
    const prompt = construirSystemPrompt(
      criarConfig({
        objetivo: {},
        abordagens: {},
        contexto: {},
        tom_voz: {},
        regras: { regras: [], palavras_chave_obrigatorias: [], palavras_chave_bloqueadas: [] }
      })
    );
    expect(prompt).toContain('FORMATO DE RESPOSTA');
    expect(prompt).toContain('Você é Klaus.');
  });

  it('inclui REGRA_FORMATO no fallback total (config null)', () => {
    const prompt = construirSystemPrompt(null);
    expect(prompt).toContain('FORMATO DE RESPOSTA');
    expect(prompt).not.toContain('Klaus');
  });
});
