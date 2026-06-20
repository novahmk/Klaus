import { query } from '../../infra/database';
import { logger } from '../../components/shared/logger';
import {
  buildProspeccaoCorrelationId,
  normalizePhoneE164
} from './contract';

interface DuplicateCheckInput {
  telefones: string[];
}

interface ImportLeadItem {
  nome?: string;
  telefone: string;
  email?: string;
  origem?: string;
  metadata?: Record<string, unknown>;
}

interface ImportLeadsInput {
  clienteId?: string;
  origem?: string;
  correlationId?: string;
  itens: ImportLeadItem[];
}

const DEFAULT_IMPORT_LIMIT = Number(process.env.CSV_IMPORT_MAX_BATCH || 2000);
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

async function findExistingLeadIds(leadIds: string[]): Promise<Set<string>> {
  if (!leadIds.length) return new Set();

  const { rows } = await query<{ lead_id: string }>(
    'SELECT lead_id FROM leads WHERE lead_id = ANY($1::varchar[])',
    [leadIds]
  );

  return new Set(rows.map((row) => row.lead_id));
}

export async function checkDuplicateLeads(input: DuplicateCheckInput): Promise<{
  total: number;
  duplicates: Array<{
    telefoneOriginal: string;
    telefoneE164?: string;
    leadId?: string;
    exists: boolean;
    error?: string;
  }>;
}> {
  const rawPhones = Array.isArray(input.telefones) ? input.telefones : [];

  const normalized = rawPhones.map((phone) => {
    const telefoneOriginal = String(phone || '').trim();
    try {
      const telefoneE164 = normalizePhoneE164(telefoneOriginal);
      const leadId = telefoneE164.replace(/[^0-9]/g, '');
      return { telefoneOriginal, telefoneE164, leadId, error: undefined };
    } catch (error) {
      return {
        telefoneOriginal,
        telefoneE164: undefined,
        leadId: undefined,
        error: (error as Error).message
      };
    }
  });

  const leadIds = normalized
    .filter((n) => n.leadId)
    .map((n) => n.leadId as string);
  const existing = await findExistingLeadIds(leadIds);

  return {
    total: rawPhones.length,
    duplicates: normalized.map((item) => ({
      telefoneOriginal: item.telefoneOriginal,
      telefoneE164: item.telefoneE164,
      leadId: item.leadId,
      exists: item.leadId ? existing.has(item.leadId) : false,
      error: item.error
    }))
  };
}

export async function importLeadsBulk(input: ImportLeadsInput): Promise<{
  accepted: boolean;
  total: number;
  imported: number;
  duplicatesInFile: number;
  duplicatesInDb: number;
  invalid: number;
  correlationId: string;
  results: Array<{
    index: number;
    status: 'imported' | 'duplicate_in_file' | 'duplicate_in_db' | 'invalid';
    leadId?: string;
    to?: string;
    error?: string;
  }>;
}> {
  const items = Array.isArray(input.itens) ? input.itens : [];
  if (!items.length) {
    throw new Error('itens é obrigatório e deve conter ao menos 1 item');
  }
  if (items.length > DEFAULT_IMPORT_LIMIT) {
    throw new Error(`lote excede limite de ${DEFAULT_IMPORT_LIMIT} itens`);
  }

  const clienteId =
    String(input.clienteId || '').trim() ||
    process.env.DEFAULT_CLIENTE_ID ||
    'default';
  const origemPadrao = String(input.origem || '').trim() || 'Importacao CSV';
  const correlationId =
    String(input.correlationId || '').trim() ||
    buildProspeccaoCorrelationId('csv');

  const seenInFile = new Set<string>();
  const provisionalResults: Array<{
    index: number;
    status: 'imported' | 'duplicate_in_file' | 'duplicate_in_db' | 'invalid';
    leadId?: string;
    to?: string;
    error?: string;
    payload?: {
      leadId: string;
      telefoneE164: string;
      nome: string;
      email?: string;
      origem: string;
      metadata: Record<string, unknown>;
    };
  }> = [];

  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    const telefoneOriginal = String(item.telefone || '').trim();

    try {
      const telefoneE164 = normalizePhoneE164(telefoneOriginal);
      const leadId = telefoneE164.replace(/[^0-9]/g, '');
      const nome = String(item.nome || '').trim() || 'Lead Importado';
      const email = String(item.email || '').trim();
      const origem = String(item.origem || '').trim() || origemPadrao;

      if (email && !isValidEmail(email)) {
        throw new Error('email inválido');
      }

      if (seenInFile.has(leadId)) {
        provisionalResults.push({
          index,
          status: 'duplicate_in_file',
          leadId,
          to: telefoneE164,
          error: 'telefone duplicado no mesmo arquivo'
        });
        continue;
      }
      seenInFile.add(leadId);

      provisionalResults.push({
        index,
        status: 'imported',
        leadId,
        to: telefoneE164,
        payload: {
          leadId,
          telefoneE164,
          nome,
          email: email || undefined,
          origem,
          metadata: item.metadata || {}
        }
      });
    } catch (error) {
      provisionalResults.push({
        index,
        status: 'invalid',
        error: (error as Error).message
      });
    }
  }

  const candidates = provisionalResults.filter((r) => r.payload);
  const existingIds = await findExistingLeadIds(
    candidates.map((c) => c.leadId as string)
  );

  let imported = 0;
  for (const item of provisionalResults) {
    if (!item.payload || !item.leadId) continue;

    if (existingIds.has(item.leadId)) {
      item.status = 'duplicate_in_db';
      item.error = 'lead já existente na base';
      delete item.payload;
      continue;
    }

    const payload = item.payload;
    try {
      await query(
        `INSERT INTO leads (lead_id, data, nome, telefone, email, status, etapa_funil)
         VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7)
         ON CONFLICT (lead_id) DO NOTHING`,
        [
          payload.leadId,
          JSON.stringify({
            origem: payload.origem,
            source: 'csv-import',
            clienteId,
            correlationId,
            metadata: payload.metadata
          }),
          payload.nome,
          payload.telefoneE164,
          payload.email || null,
          'prospeccao',
          'novo'
        ]
      );

      imported++;
      delete item.payload;
    } catch (error) {
      item.status = 'invalid';
      item.error = `falha ao inserir: ${(error as Error).message}`;
      delete item.payload;
    }
  }

  const results = provisionalResults.map((item) => ({
    index: item.index,
    status: item.status,
    leadId: item.leadId,
    to: item.to,
    error: item.error
  }));

  const duplicatesInFile = results.filter(
    (r) => r.status === 'duplicate_in_file'
  ).length;
  const duplicatesInDb = results.filter(
    (r) => r.status === 'duplicate_in_db'
  ).length;
  const invalid = results.filter((r) => r.status === 'invalid').length;

  return {
    accepted: imported > 0,
    total: items.length,
    imported,
    duplicatesInFile,
    duplicatesInDb,
    invalid,
    correlationId,
    results
  };
}

export async function registrarAuditoriaDisparo(input: {
  correlationId: string;
  clienteId: string;
  origem: string;
  total: number;
  enqueued: number;
  failed: number;
  payload: unknown;
  resultado: unknown;
}): Promise<void> {
  try {
    await query(
      `INSERT INTO prospeccao_dispatch_audit
         (correlation_id, cliente_id, origem, total, enqueued, failed, payload, resultado)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)`,
      [
        input.correlationId,
        input.clienteId,
        input.origem,
        input.total,
        input.enqueued,
        input.failed,
        JSON.stringify(input.payload),
        JSON.stringify(input.resultado)
      ]
    );
  } catch (error) {
    logger.warn(
      {
        correlationId: input.correlationId,
        erro: (error as Error).message
      },
      'Prospeccao: falha ao gravar auditoria de disparo'
    );
  }
}
