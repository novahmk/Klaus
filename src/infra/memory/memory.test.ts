// src/infra/memory/memory.test.ts
/**
 * Testes - Subsistema de Memória
 * Klaus V2
 *
 * Cobrem state-adapter (fallback in-memory), lead-state e conversation-repo
 * com stub do módulo de banco (sem PostgreSQL real).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createAdapter } from './state-adapter';
import { LeadState } from './lead-state';

// Stub do pool/query (sem PostgreSQL real)
const queryMock = vi.fn();
vi.mock('../database/pool', () => ({
  query: (text: string, params?: unknown[]) => queryMock(text, params)
}));

describe('Memória - state-adapter (fallback in-memory)', () => {
  it('deve armazenar e recuperar valores', async () => {
    const adapter = createAdapter<string>('teste');
    await adapter.set('a', 'valor');
    expect(await adapter.get('a')).toBe('valor');
  });

  it('deve retornar null para chave inexistente', async () => {
    const adapter = createAdapter('teste');
    expect(await adapter.get('inexistente')).toBeNull();
  });

  it('deve reportar has corretamente', async () => {
    const adapter = createAdapter<number>('teste');
    expect(await adapter.has('x')).toBe(false);
    await adapter.set('x', 1);
    expect(await adapter.has('x')).toBe(true);
  });

  it('deve deletar valores', async () => {
    const adapter = createAdapter<number>('teste');
    await adapter.set('x', 1);
    await adapter.delete('x');
    expect(await adapter.get('x')).toBeNull();
    expect(adapter.size()).toBe(0);
  });

  it('deve isolar valores complexos (objetos)', async () => {
    const adapter = createAdapter<{ msgs: string[] }>('hist');
    await adapter.set('lead-1', { msgs: ['oi', 'tudo bem'] });
    const val = await adapter.get('lead-1');
    expect(val?.msgs).toHaveLength(2);
  });
});

describe('Memória - LeadState', () => {
  it('deve criar estado inicial com defaults', () => {
    const lead = LeadState.createNew('5511999998888', 'João');
    expect(lead.lead_id).toBe('5511999998888');
    expect(lead.nome).toBe('João');
    expect(lead.etapa_funil).toBe('novo');
    expect(lead.temperatura).toBe('cold');
    expect(lead.score).toBe(0);
    expect(lead.contexto_conversa).toEqual([]);
    expect(lead.qualificacao.pronto_para_agendamento).toBe(false);
  });

  it('deve usar "Cliente" como nome padrão', () => {
    const lead = LeadState.createNew('5511000000000');
    expect(lead.nome).toBe('Cliente');
  });
});

describe('Memória - conversation-repo', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it('deve carregar histórico em ordem cronológica', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        { role: 'assistant', conteudo: 'resposta 2' },
        { role: 'user', conteudo: 'msg 2' },
        { role: 'assistant', conteudo: 'resposta 1' },
        { role: 'user', conteudo: 'msg 1' }
      ]
    });

    const { carregarHistorico } = await import('./conversation-repo');
    const hist = await carregarHistorico('5511999998888');

    // reverse → cronológica
    expect(hist[0].conteudo).toBe('msg 1');
    expect(hist[hist.length - 1].conteudo).toBe('resposta 2');
  });

  it('deve retornar array vazio em caso de erro', async () => {
    queryMock.mockRejectedValueOnce(new Error('db down'));
    const { carregarHistorico } = await import('./conversation-repo');
    expect(await carregarHistorico('x')).toEqual([]);
  });

  it('deve detectar duplicata quando existe registro', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    const { jaFoiProcessada } = await import('./conversation-repo');
    expect(await jaFoiProcessada('msg-1')).toBe(true);
  });

  it('deve retornar false para messageId vazio', async () => {
    const { jaFoiProcessada } = await import('./conversation-repo');
    expect(await jaFoiProcessada('')).toBe(false);
  });

  it('não deve gravar mensagem com campos ausentes', async () => {
    const { salvarMensagem } = await import('./conversation-repo');
    await salvarMensagem('', 'user', '');
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('deve injetar contexto frio quando há gap longo', async () => {
    const oito_horas_atras = new Date(Date.now() - 8 * 3_600_000);
    queryMock.mockResolvedValueOnce({ rows: [{ created_at: oito_horas_atras }] });

    const { injetarContextoFrio } = await import('./conversation-repo');
    const prompt = await injetarContextoFrio('PROMPT BASE', '5511999998888');

    expect(prompt).toContain('PROMPT BASE');
    expect(prompt).toContain('RETOMADA DE CONVERSA');
  });

  it('não deve injetar contexto frio quando a conversa é recente', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ created_at: new Date() }] });
    const { injetarContextoFrio } = await import('./conversation-repo');
    const prompt = await injetarContextoFrio('PROMPT BASE', '5511999998888');
    expect(prompt).toBe('PROMPT BASE');
  });
});
