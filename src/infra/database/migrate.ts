// src/infra/database/migrate.ts
import { readdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getPool, fechar } from './pool.js';
import { logger } from '../../components/shared/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, 'migrations');

/**
 * Lista os arquivos .sql de migração em ordem alfabética (001, 002, ...).
 */
export function listarMigrations(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

/**
 * Executa as migrations pendentes de forma idempotente.
 * Cria a tabela _migrations para rastrear o que já foi aplicado.
 */
export async function migrar(): Promise<string[]> {
  const pool = getPool();
  const aplicadas: string[] = [];

  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      nome VARCHAR(255) PRIMARY KEY,
      aplicada_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  const { rows } = await pool.query<{ nome: string }>(
    'SELECT nome FROM _migrations'
  );
  const jaAplicadas = new Set(rows.map((r) => r.nome));

  for (const arquivo of listarMigrations()) {
    if (jaAplicadas.has(arquivo)) {
      logger.debug({ arquivo }, 'Migration já aplicada — pulando');
      continue;
    }

    const sql = readFileSync(join(MIGRATIONS_DIR, arquivo), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migrations (nome) VALUES ($1)', [
        arquivo
      ]);
      await client.query('COMMIT');
      aplicadas.push(arquivo);
      logger.info({ arquivo }, 'Migration aplicada');
    } catch (erro) {
      await client.query('ROLLBACK');
      logger.error(
        { arquivo, erro: (erro as Error).message },
        'Falha ao aplicar migration'
      );
      throw erro;
    } finally {
      client.release();
    }
  }

  return aplicadas;
}

// Execução direta: npm run migrate
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    try {
      const aplicadas = await migrar();
      if (aplicadas.length === 0) {
        console.log('✅ Nenhuma migration pendente.');
      } else {
        console.log(`✅ ${aplicadas.length} migration(s) aplicada(s):`);
        aplicadas.forEach((m) => console.log(`   - ${m}`));
      }
    } catch (erro) {
      console.error('❌ Erro nas migrations:', (erro as Error).message);
      process.exitCode = 1;
    } finally {
      await fechar();
    }
  })();
}
