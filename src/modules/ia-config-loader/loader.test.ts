/**
 * Testes - IA Config Loader
 * Cobre: obterConfigIA, loadConfigFromSupabase, iniciarIAConfigLoader
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { getDefaultConfigIA } from './defaults';
import { ConfigIA } from './types';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../lib/supabase', () => ({
  getSupabaseClient: vi.fn(),
  querySupabaseWithTimeout: vi.fn()
}));

vi.mock('../../lib/cache', () => {
  const store = new Map<string, unknown>();
  return {
    getGlobalCache: () => ({
      get: (key: string) => store.get(key) ?? null,
      set: (key: string, value: unknown) => store.set(key, value),
      delete: (key: string) => store.delete(key),
      clear: () => store.clear()
    })
  };
});

vi.mock('../../components/shared/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

import { getSupabaseClient, querySupabaseWithTimeout } from '../../lib/supabase';
import { getGlobalCache } from '../../lib/cache';
import { obterConfigIA, loadConfigFromSupabase } from './loader';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function criarConfigIAMock(clienteId = 'cliente-1'): ConfigIA {
  return {
    cliente_id: clienteId,
    parametros: { max_tokens: 300, temperature: 0.5, model: 'gpt-4o' },
    validacao: { min_length: 100, max_length: 600, min_score: 60, max_retries: 5 },
    tom_voz: {
      tom_geral: 'consultivo',
      tom_executivo: 'Foco em ROI.',
      tom_tecnico: 'Foco em specs.',
      tom_suporte: 'Foco em usabilidade.'
    },
    regras: {
      regras: ['Seja direto.', 'Use dados reais.'],
      palavras_chave_bloqueadas: ['infelizmente'],
      palavras_chave_obrigatorias: ['ROI']
    },
    disparos: {
      intervalo_min_segundos: 1800,
      intervalo_max_segundos: 3600,
      limite_diario: 30
    },
    aprendizado: { ativo: true, metricas_habilitadas: true },
    ultima_atualizacao: new Date().toISOString()
  };
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('IAConfigLoader - loadConfigFromSupabase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getGlobalCache().clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('retorna null quando Supabase não está disponível', async () => {
    vi.mocked(getSupabaseClient).mockReturnValue(null);

    const result = await loadConfigFromSupabase('cliente-1');
    expect(result).toBeNull();
  });

  it('retorna null quando querySupabaseWithTimeout retorna null (timeout)', async () => {
    vi.mocked(getSupabaseClient).mockReturnValue({} as ReturnType<typeof getSupabaseClient>);
    vi.mocked(querySupabaseWithTimeout).mockResolvedValue(null);

    const result = await loadConfigFromSupabase('cliente-1');
    expect(result).toBeNull();
  });

  it('retorna ConfigIA quando Supabase responde com sucesso', async () => {
    const mockConfig = criarConfigIAMock('cliente-1');
    vi.mocked(getSupabaseClient).mockReturnValue({} as ReturnType<typeof getSupabaseClient>);
    vi.mocked(querySupabaseWithTimeout).mockResolvedValue(mockConfig);

    const result = await loadConfigFromSupabase('cliente-1');
    expect(result).toEqual(mockConfig);
    expect(result?.parametros.max_tokens).toBe(300);
    expect(result?.validacao.min_length).toBe(100);
  });

  it('retorna null quando querySupabaseWithTimeout lança exceção', async () => {
    vi.mocked(getSupabaseClient).mockReturnValue({} as ReturnType<typeof getSupabaseClient>);
    vi.mocked(querySupabaseWithTimeout).mockRejectedValue(new Error('Supabase timeout'));

    const result = await loadConfigFromSupabase('cliente-1');
    expect(result).toBeNull();
  });
});

describe('IAConfigLoader - obterConfigIA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getGlobalCache().clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('retorna defaults quando Supabase não está disponível', async () => {
    vi.mocked(getSupabaseClient).mockReturnValue(null);

    const result = await obterConfigIA('cliente-1');
    const defaults = getDefaultConfigIA('cliente-1');

    expect(result.parametros.max_tokens).toBe(defaults.parametros.max_tokens);
    expect(result.parametros.temperature).toBe(defaults.parametros.temperature);
    expect(result.validacao.min_length).toBe(defaults.validacao.min_length);
    expect(result.validacao.max_length).toBe(defaults.validacao.max_length);
  });

  it('retorna config do Supabase quando disponível', async () => {
    const mockConfig = criarConfigIAMock('cliente-2');
    vi.mocked(getSupabaseClient).mockReturnValue({} as ReturnType<typeof getSupabaseClient>);
    vi.mocked(querySupabaseWithTimeout).mockResolvedValue(mockConfig);

    const result = await obterConfigIA('cliente-2');
    expect(result.parametros.max_tokens).toBe(300);
    expect(result.parametros.temperature).toBe(0.5);
    expect(result.validacao.min_length).toBe(100);
  });

  it('retorna do cache na segunda chamada sem chamar Supabase', async () => {
    const mockConfig = criarConfigIAMock('cliente-3');
    vi.mocked(getSupabaseClient).mockReturnValue({} as ReturnType<typeof getSupabaseClient>);
    vi.mocked(querySupabaseWithTimeout).mockResolvedValue(mockConfig);

    // Primeira chamada: carrega do Supabase
    await obterConfigIA('cliente-3');
    // Segunda chamada: deve vir do cache
    await obterConfigIA('cliente-3');

    // querySupabaseWithTimeout deve ter sido chamado apenas uma vez
    expect(vi.mocked(querySupabaseWithTimeout)).toHaveBeenCalledTimes(1);
  });

  it('nunca lança exceção — sempre retorna ConfigIA válida', async () => {
    vi.mocked(getSupabaseClient).mockImplementation(() => {
      throw new Error('Erro inesperado');
    });

    await expect(obterConfigIA('cliente-erro')).resolves.toBeDefined();
  });

  it('defaults têm valores seguros esperados', async () => {
    vi.mocked(getSupabaseClient).mockReturnValue(null);

    const result = await obterConfigIA('cliente-default');
    expect(result.parametros.max_tokens).toBe(200);
    expect(result.parametros.temperature).toBe(0.4);
    expect(result.validacao.min_length).toBe(150);
    expect(result.validacao.max_length).toBe(500);
    expect(result.validacao.min_score).toBe(70);
    expect(result.validacao.max_retries).toBe(3);
    expect(result.disparos.limite_diario).toBe(50);
  });
});
