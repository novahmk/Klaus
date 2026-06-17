// src/infra/database/database.test.ts
/**
 * Testes - Pilar Banco de Dados
 * Klaus V2
 *
 * Cobrem a listagem/ordem das migrations e o singleton do pool, sem
 * conectar a um PostgreSQL real.
 */

import { describe, it, expect } from 'vitest';
import { listarMigrations } from './migrate';
import { getPool } from './pool';

describe('Database - migrations', () => {
  it('deve listar os arquivos .sql em ordem', () => {
    const migrations = listarMigrations();
    expect(migrations.length).toBeGreaterThanOrEqual(6);
    const ordenado = [...migrations].sort();
    expect(migrations).toEqual(ordenado);
    expect(migrations[0]).toBe('001_busca_banco.sql');
  });

  it('deve conter todas as migrations esperadas', () => {
    const migrations = listarMigrations();
    expect(migrations).toContain('005_conversas.sql');
    expect(migrations).toContain('006_leads.sql');
  });
});

describe('Database - pool', () => {
  it('deve retornar a mesma instância (singleton)', () => {
    const p1 = getPool();
    const p2 = getPool();
    expect(p1).toBe(p2);
  });
});
