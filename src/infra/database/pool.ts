// src/infra/database/pool.ts
import { Pool, QueryResult, QueryResultRow } from 'pg';
import { logger } from '../../components/shared/logger';

let pool: Pool | null = null;

/**
 * Retorna o Pool singleton de conexão com o PostgreSQL.
 * Usa DATABASE_URL; lazy-init na primeira chamada.
 */
export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    pool = new Pool({
      connectionString,
      max: Number(process.env.PG_POOL_MAX) || 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });

    pool.on('error', (err) => {
      logger.error({ erro: err.message }, 'Erro inesperado no pool PostgreSQL');
    });

    logger.info('Pool PostgreSQL inicializado');
  }
  return pool;
}

/**
 * Helper de query tipado sobre o pool singleton.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params as never[]);
}

/**
 * Encerra o pool (graceful shutdown).
 */
export async function fechar(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Pool PostgreSQL encerrado');
  }
}
