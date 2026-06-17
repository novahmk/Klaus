// src/infra/database/index.ts
export { getPool, query, fechar } from './pool';
export { migrar, listarMigrations } from './migrate';
