export interface ManualDispatchContractItem {
  telefone: string;
  nome?: string;
  mensagem?: string;
  metadata?: Record<string, unknown>;
}

export interface ManualDispatchContractRequest {
  clienteId?: string;
  origem?: string;
  correlationId?: string;
  mensagem?: string;
  itens: ManualDispatchContractItem[];
}

export interface ManualDispatchNormalizedItem {
  index: number;
  telefoneOriginal: string;
  telefoneE164: string;
  leadId: string;
  nome?: string;
  mensagem: string;
  metadata: Record<string, unknown>;
}

export interface ManualDispatchNormalizedRequest {
  clienteId: string;
  origem: string;
  correlationId: string;
  itens: ManualDispatchNormalizedItem[];
}

const DEFAULT_BATCH_LIMIT = Number(process.env.MANUAL_DISPATCH_MAX_BATCH || 200);
const DEFAULT_IMPORT_LIMIT = Number(process.env.CSV_IMPORT_MAX_BATCH || 2000);

export function normalizePhoneE164(raw: string): string {
  const digits = String(raw || '').replace(/[^0-9]/g, '');
  if (!digits) throw new Error('telefone ausente');

  let normalized = digits;
  if (!normalized.startsWith('55') && (normalized.length === 10 || normalized.length === 11)) {
    normalized = `55${normalized}`;
  }

  if (normalized.length < 12 || normalized.length > 13) {
    throw new Error('telefone inválido para BR (esperado DDI+DDD+numero)');
  }

  return `+${normalized}`;
}

function buildCorrelationId(): string {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `manual-${stamp}-${rand}`;
}

export function getProspeccaoContract(): Record<string, unknown> {
  return {
    version: '2026-06-20.1',
    endpoints: {
      manualDispatch: {
        method: 'POST',
        path: '/api/prospeccao/manual-disparos',
        auth: 'x-internal-api-key: <INTERNAL_API_KEY> (opcional fora de prod)',
        limits: {
          maxBatch: DEFAULT_BATCH_LIMIT
        },
        request: {
          clienteId: 'string (opcional, default DEFAULT_CLIENTE_ID|default)',
          origem: 'string (opcional, default Disparo manual)',
          correlationId: 'string (opcional, gerado automaticamente)',
          mensagem: 'string (opcional se cada item tiver mensagem)',
          itens: [
            {
              telefone: 'string (obrigatorio, normalizado para E.164 BR)',
              nome: 'string (opcional)',
              mensagem: 'string (opcional, sobrescreve mensagem global)',
              metadata: 'object (opcional)'
            }
          ]
        },
        response: {
          accepted: 'boolean',
          total: 'number',
          enqueued: 'number',
          failed: 'number',
          correlationId: 'string',
          results: [
            {
              index: 'number',
              leadId: 'string',
              to: 'string',
              status: 'enqueued|failed',
              jobId: 'string|undefined',
              error: 'string|undefined'
            }
          ]
        }
      },
      csvImport: {
        method: 'POST',
        path: '/api/prospeccao/importar-leads',
        auth: 'x-internal-api-key: <INTERNAL_API_KEY> (opcional fora de prod)',
        limits: {
          maxBatch: DEFAULT_IMPORT_LIMIT
        },
        request: {
          clienteId: 'string (opcional, default DEFAULT_CLIENTE_ID|default)',
          origem: 'string (opcional, default Importacao CSV)',
          itens: [
            {
              nome: 'string (opcional)',
              telefone: 'string (obrigatorio)',
              email: 'string (opcional)',
              origem: 'string (opcional)',
              metadata: 'object (opcional)'
            }
          ]
        },
        response: {
          accepted: 'boolean',
          total: 'number',
          imported: 'number',
          duplicatesInFile: 'number',
          duplicatesInDb: 'number',
          invalid: 'number',
          correlationId: 'string',
          results: [
            {
              index: 'number',
              status: 'imported|duplicate_in_file|duplicate_in_db|invalid',
              leadId: 'string|undefined',
              to: 'string|undefined',
              error: 'string|undefined'
            }
          ]
        }
      },
      checkDuplicates: {
        method: 'POST',
        path: '/api/prospeccao/check-duplicados',
        auth: 'x-internal-api-key: <INTERNAL_API_KEY> (opcional fora de prod)',
        request: {
          telefones: ['string']
        },
        response: {
          total: 'number',
          duplicates: [
            {
              telefoneOriginal: 'string',
              telefoneE164: 'string',
              leadId: 'string',
              exists: 'boolean',
              error: 'string|undefined'
            }
          ]
        }
      },
      contract: {
        method: 'GET',
        path: '/api/prospeccao/contract',
        response: 'objeto versionado do contrato'
      }
    }
  };
}

export function normalizeManualDispatchRequest(
  payload: unknown
): ManualDispatchNormalizedRequest {
  const body = (payload || {}) as ManualDispatchContractRequest;
  const itens = Array.isArray(body.itens) ? body.itens : [];

  if (!itens.length) {
    throw new Error('itens é obrigatório e deve conter ao menos 1 item');
  }

  if (itens.length > DEFAULT_BATCH_LIMIT) {
    throw new Error(`lote excede limite de ${DEFAULT_BATCH_LIMIT} itens`);
  }

  const mensagemGlobal = String(body.mensagem || '').trim();
  const clienteId =
    String(body.clienteId || '').trim() ||
    process.env.DEFAULT_CLIENTE_ID ||
    'default';
  const origem = String(body.origem || '').trim() || 'Disparo manual';
  const correlationId =
    String(body.correlationId || '').trim() || buildCorrelationId();

  const normalizedItems = itens.map((item, index) => {
    const telefoneOriginal = String(item.telefone || '').trim();
    const telefoneE164 = normalizePhoneE164(telefoneOriginal);
    const leadId = telefoneE164.replace(/[^0-9]/g, '');
    const mensagemItem = String(item.mensagem || '').trim() || mensagemGlobal;

    if (!mensagemItem) {
      throw new Error(`item ${index}: mensagem ausente`);
    }

    return {
      index,
      telefoneOriginal,
      telefoneE164,
      leadId,
      nome: item.nome,
      mensagem: mensagemItem,
      metadata: item.metadata || {}
    } as ManualDispatchNormalizedItem;
  });

  return {
    clienteId,
    origem,
    correlationId,
    itens: normalizedItems
  };
}

export function buildProspeccaoCorrelationId(prefix: string): string {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${stamp}-${rand}`;
}

