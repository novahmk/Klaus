// src/modules/config-loader/index.test.ts
/**
 * Testes - Config Loader (Sprint 1/7)
 * Klaus V2
 *
 * Cobrem o cruzamento de nomes de tabela com o schema real do Supabase
 * (cfg_ia_*), o carregamento resiliente por tabela (Fase 3: uma tabela
 * falhando não derruba as demais) e o fallback total quando todas falham.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { getSupabaseClientMock, querySupabaseWithTimeoutMock } = vi.hoisted(() => ({
  getSupabaseClientMock: vi.fn(),
  querySupabaseWithTimeoutMock: vi.fn()
}));

vi.mock('../../lib/supabase', () => ({
  getSupabaseClient: getSupabaseClientMock,
  querySupabaseWithTimeout: querySupabaseWithTimeoutMock
}));

import { obterConfig, obterConfigScoring, limparConfigCache } from './index';

type Resposta = { data: Record<string, unknown> | null; error: { message: string; code?: string } | null };

/**
 * Constrói um client Supabase falso cujo `.from(tabela)` resolve com a
 * resposta configurada para aquela tabela (encadeando .select().eq().maybeSingle()/.single()).
 */
function criarSupabaseStub(respostasPorTabela: Record<string, Resposta>) {
  return {
    from: (tabela: string) => {
      const resposta: Resposta = respostasPorTabela[tabela] ?? { data: null, error: null };
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: () => Promise.resolve(resposta),
        single: () => Promise.resolve(resposta)
      };
      return builder;
    }
  };
}

describe('Config Loader - obterConfig (tabelas cfg_ia_*)', () => {
  beforeEach(() => {
    limparConfigCache();
    getSupabaseClientMock.mockReset();
    querySupabaseWithTimeoutMock.mockReset();
  });

  it('carrega config completa quando as 6 tabelas cfg_ia_* respondem com sucesso', async () => {
    const client = criarSupabaseStub({
      cfg_ia_persona: { data: { nome: 'Klaus', descricao: 'Especialista em transplante capilar' }, error: null },
      cfg_ia_objetivo: { data: { objetivo_curto: 'Agendar avaliação', objetivo_longo: 'Converter lead em consulta' }, error: null },
      cfg_ia_abordagens: { data: { abordagem_inicial: 'Acolher', abordagem_objecao: 'Rebater com dados', abordagem_fechamento: 'Convidar para agendar' }, error: null },
      cfg_ia_contexto: { data: { cargo_alvo: 'paciente', palavras_chave_bloqueadas: ['garantia'], base_conhecimento: 'FUE, FUT' }, error: null },
      cfg_ia_tom_voz: { data: { tom_geral: 'acolhedor' }, error: null },
      cfg_ia_regras: { data: { regras: ['Nunca prometer resultado'], palavras_chave_obrigatorias: [], palavras_chave_bloqueadas: [] }, error: null }
    });

    getSupabaseClientMock.mockReturnValue(client);
    querySupabaseWithTimeoutMock.mockImplementation((fn: (c: unknown) => unknown) => fn(client));

    const config = await obterConfig('cliente-1');

    expect(config).not.toBeNull();
    expect(config?.persona.nome).toBe('Klaus');
    expect(config?.objetivo.objetivo_longo).toBe('Converter lead em consulta');
    expect(config?.contexto.cargo_alvo).toBe('paciente');
  });

  it('Fase 3: mantém as tabelas que carregaram mesmo se outras falharem (não zera tudo)', async () => {
    const client = criarSupabaseStub({
      cfg_ia_persona: { data: { nome: 'Klaus', descricao: 'Especialista' }, error: null },
      cfg_ia_objetivo: { data: null, error: { message: 'relation "cfg_ia_objetivo" does not exist', code: '42P01' } },
      cfg_ia_abordagens: { data: null, error: { message: 'relation does not exist', code: '42P01' } },
      cfg_ia_contexto: { data: { cargo_alvo: 'paciente' }, error: null },
      cfg_ia_tom_voz: { data: null, error: { message: 'timeout' } },
      cfg_ia_regras: { data: null, error: { message: 'timeout' } }
    });

    getSupabaseClientMock.mockReturnValue(client);
    querySupabaseWithTimeoutMock.mockImplementation((fn: (c: unknown) => unknown) => fn(client));

    const config = await obterConfig('cliente-1');

    expect(config).not.toBeNull();
    // persona e contexto carregaram: devem estar presentes
    expect(config?.persona.nome).toBe('Klaus');
    expect(config?.contexto.cargo_alvo).toBe('paciente');
    // objetivo/abordagens falharam: caem em default vazio, sem quebrar o restante
    expect(config?.objetivo).toEqual({});
    expect(config?.abordagens).toEqual({});
  });

  it('retorna null (fallback total) quando as 6 tabelas falham', async () => {
    const erro = { data: null, error: { message: 'relation does not exist', code: '42P01' } };
    const client = criarSupabaseStub({
      cfg_ia_persona: erro,
      cfg_ia_objetivo: erro,
      cfg_ia_abordagens: erro,
      cfg_ia_contexto: erro,
      cfg_ia_tom_voz: erro,
      cfg_ia_regras: erro
    });

    getSupabaseClientMock.mockReturnValue(client);
    querySupabaseWithTimeoutMock.mockImplementation((fn: (c: unknown) => unknown) => fn(client));

    const config = await obterConfig('cliente-1');

    expect(config).toBeNull();
  });

  it('retorna null quando o client Supabase não está disponível', async () => {
    getSupabaseClientMock.mockReturnValue(null);

    const config = await obterConfig('cliente-1');

    expect(config).toBeNull();
    expect(querySupabaseWithTimeoutMock).not.toHaveBeenCalled();
  });
});

describe('Config Loader - obterConfigScoring (tabela config_scoring)', () => {
  beforeEach(() => {
    limparConfigCache();
    getSupabaseClientMock.mockReset();
    querySupabaseWithTimeoutMock.mockReset();
  });

  it('consulta a tabela config_scoring (renomeada de cfg_scoring)', async () => {
    const client = criarSupabaseStub({
      config_scoring: {
        data: {
          peso_intencao: 0.4,
          peso_engajamento: 0.3,
          peso_contexto: 0.2,
          peso_historico: 0.1,
          scores_intencao: {},
          threshold_handoff: 90,
          threshold_notificacao: 70
        },
        error: null
      }
    });

    getSupabaseClientMock.mockReturnValue(client);
    querySupabaseWithTimeoutMock.mockImplementation((fn: (c: unknown) => unknown) => fn(client));

    const scoring = await obterConfigScoring('cliente-1');

    expect(scoring).not.toBeNull();
    expect(scoring?.threshold_handoff).toBe(90);
  });
});
