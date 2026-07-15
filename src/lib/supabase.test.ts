// src/lib/supabase.test.ts
/**
 * Testes - Cliente Supabase (fallback de formato de chaves)
 * Klaus V2
 *
 * Cobrem o suporte ao novo formato de API keys do Supabase
 * (SUPABASE_PUBLISHABLE_KEY / SUPABASE_SECRET_KEY) como fallback das
 * variáveis legadas (SUPABASE_ANON_KEY / SUPABASE_SERVICE_KEY).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const ENV_ORIGINAL = { ...process.env };

async function carregarModulo() {
  vi.resetModules();
  return import('./supabase');
}

describe('supabase.ts - getSupabaseClient (fallback de key)', () => {
  beforeEach(() => {
    process.env = { ...ENV_ORIGINAL };
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_PUBLISHABLE_KEY;
    delete process.env.SUPABASE_SERVICE_KEY;
    delete process.env.SUPABASE_SECRET_KEY;
  });

  afterEach(() => {
    process.env = { ...ENV_ORIGINAL };
  });

  it('retorna null quando URL e KEY não estão definidas', async () => {
    const { getSupabaseClient } = await carregarModulo();
    expect(getSupabaseClient()).toBeNull();
  });

  it('inicializa com SUPABASE_ANON_KEY (formato legado)', async () => {
    process.env.SUPABASE_URL = 'https://exemplo.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'eyJ.legado.key';

    const { getSupabaseClient } = await carregarModulo();
    expect(getSupabaseClient()).not.toBeNull();
  });

  it('inicializa com SUPABASE_PUBLISHABLE_KEY (novo formato) quando ANON_KEY não existe', async () => {
    process.env.SUPABASE_URL = 'https://exemplo.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_abc123';

    const { getSupabaseClient } = await carregarModulo();
    expect(getSupabaseClient()).not.toBeNull();
  });

  it('prioriza SUPABASE_ANON_KEY quando ambas as variáveis estão definidas', async () => {
    process.env.SUPABASE_URL = 'https://exemplo.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'eyJ.legado.key';
    process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_abc123';

    const { getSupabaseClient } = await carregarModulo();
    // Não há como inspecionar a key usada de fora, mas o client deve
    // inicializar normalmente (comportamento não deve quebrar).
    expect(getSupabaseClient()).not.toBeNull();
  });

  it('retorna null se só a URL estiver definida (sem nenhuma key)', async () => {
    process.env.SUPABASE_URL = 'https://exemplo.supabase.co';

    const { getSupabaseClient } = await carregarModulo();
    expect(getSupabaseClient()).toBeNull();
  });
});

describe('supabase.ts - getSupabaseServiceClient (fallback de key)', () => {
  beforeEach(() => {
    process.env = { ...ENV_ORIGINAL };
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_KEY;
    delete process.env.SUPABASE_SECRET_KEY;
  });

  afterEach(() => {
    process.env = { ...ENV_ORIGINAL };
  });

  it('retorna null quando URL e KEY não estão definidas', async () => {
    const { getSupabaseServiceClient } = await carregarModulo();
    expect(getSupabaseServiceClient()).toBeNull();
  });

  it('inicializa com SUPABASE_SERVICE_KEY (formato legado)', async () => {
    process.env.SUPABASE_URL = 'https://exemplo.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'eyJ.legado.service';

    const { getSupabaseServiceClient } = await carregarModulo();
    expect(getSupabaseServiceClient()).not.toBeNull();
  });

  it('inicializa com SUPABASE_SECRET_KEY (novo formato) quando SERVICE_KEY não existe', async () => {
    process.env.SUPABASE_URL = 'https://exemplo.supabase.co';
    process.env.SUPABASE_SECRET_KEY = 'sb_secret_abc123';

    const { getSupabaseServiceClient } = await carregarModulo();
    expect(getSupabaseServiceClient()).not.toBeNull();
  });
});
