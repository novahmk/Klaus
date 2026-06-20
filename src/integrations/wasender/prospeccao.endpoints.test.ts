import { describe, it, expect, beforeEach, vi, afterAll } from 'vitest';

const mocks = vi.hoisted(() => ({
  addJob: vi.fn(),
  checkDuplicateLeads: vi.fn(),
  importLeadsBulk: vi.fn(),
  registrarAuditoriaDisparo: vi.fn(() => Promise.resolve())
}));

vi.mock('../../components/8-filas/queue-manager', () => ({
  QueueManager: {
    getInstance: () => ({ addJob: mocks.addJob })
  }
}));

vi.mock('../../modules/prospeccao/service', () => ({
  checkDuplicateLeads: mocks.checkDuplicateLeads,
  importLeadsBulk: mocks.importLeadsBulk,
  registrarAuditoriaDisparo: mocks.registrarAuditoriaDisparo
}));

vi.mock('../../infra/health', () => ({
  attach: vi.fn()
}));

describe('WASender - prospeccao endpoints', () => {
  const originalInternalKey = process.env.INTERNAL_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.INTERNAL_API_KEY = 'test-internal-key';
  });

  afterAll(() => {
    process.env.INTERNAL_API_KEY = originalInternalKey;
  });

  async function startServer() {
    const { criarApp } = await import('./webhook-server');
    const app = criarApp();
    const server = app.listen(0, '127.0.0.1');

    await new Promise<void>((resolve) => {
      server.on('listening', () => resolve());
    });

    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const baseUrl = `http://127.0.0.1:${port}`;

    return {
      baseUrl,
      close: () =>
        new Promise<void>((resolve) => server.close(() => resolve()))
    };
  }

  it('deve bloquear sem x-internal-api-key', async () => {
    const server = await startServer();

    try {
      const response = await fetch(`${server.baseUrl}/api/prospeccao/contract`);
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: 'unauthorized' });
    } finally {
      await server.close();
    }
  });

  it('deve retornar contrato quando autorizado', async () => {
    const server = await startServer();

    try {
      const response = await fetch(`${server.baseUrl}/api/prospeccao/contract`, {
        headers: { 'x-internal-api-key': 'test-internal-key' }
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        version: string;
        endpoints: Record<string, unknown>;
      };
      expect(body.version).toBeTruthy();
      expect(body.endpoints.manualDispatch).toBeTruthy();
      expect(body.endpoints.csvImport).toBeTruthy();
      expect(body.endpoints.checkDuplicates).toBeTruthy();
    } finally {
      await server.close();
    }
  });

  it('deve enfileirar disparo manual e registrar auditoria', async () => {
    mocks.addJob.mockResolvedValueOnce({ id: 'job-1' });
    mocks.addJob.mockResolvedValueOnce({ id: 'job-2' });

    const server = await startServer();

    try {
      const response = await fetch(
        `${server.baseUrl}/api/prospeccao/manual-disparos`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-internal-api-key': 'test-internal-key'
          },
          body: JSON.stringify({
            clienteId: 'cliente-1',
            mensagem: 'Oi! Tudo bem?',
            itens: [
              { telefone: '11999998888', nome: 'Joao' },
              { telefone: '+5511988887777', nome: 'Maria' }
            ]
          })
        }
      );

      expect(response.status).toBe(202);
      const body = (await response.json()) as {
        accepted: boolean;
        total: number;
        enqueued: number;
        failed: number;
        correlationId: string;
      };

      expect(body.accepted).toBe(true);
      expect(body.total).toBe(2);
      expect(body.enqueued).toBe(2);
      expect(body.failed).toBe(0);
      expect(body.correlationId).toContain('manual-');
      expect(mocks.addJob).toHaveBeenCalledTimes(2);
      expect(mocks.registrarAuditoriaDisparo).toHaveBeenCalledOnce();
    } finally {
      await server.close();
    }
  });

  it('deve retornar 400 para payload inválido no disparo manual', async () => {
    const server = await startServer();

    try {
      const response = await fetch(
        `${server.baseUrl}/api/prospeccao/manual-disparos`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-internal-api-key': 'test-internal-key'
          },
          body: JSON.stringify({ itens: [] })
        }
      );

      expect(response.status).toBe(400);
      const body = (await response.json()) as { accepted: boolean; error: string };
      expect(body.accepted).toBe(false);
      expect(body.error).toContain('itens');
    } finally {
      await server.close();
    }
  });

  it('deve validar payload de check-duplicados', async () => {
    const server = await startServer();

    try {
      const response = await fetch(
        `${server.baseUrl}/api/prospeccao/check-duplicados`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-internal-api-key': 'test-internal-key'
          },
          body: JSON.stringify({ telefones: [] })
        }
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: 'telefones deve conter ao menos 1 item'
      });
    } finally {
      await server.close();
    }
  });

  it('deve retornar duplicados quando check-duplicados for válido', async () => {
    mocks.checkDuplicateLeads.mockResolvedValueOnce({
      total: 1,
      duplicates: [
        {
          telefoneOriginal: '11999998888',
          telefoneE164: '+5511999998888',
          leadId: '5511999998888',
          exists: true
        }
      ]
    });

    const server = await startServer();

    try {
      const response = await fetch(
        `${server.baseUrl}/api/prospeccao/check-duplicados`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-internal-api-key': 'test-internal-key'
          },
          body: JSON.stringify({ telefones: ['11999998888'] })
        }
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as { total: number };
      expect(body.total).toBe(1);
      expect(mocks.checkDuplicateLeads).toHaveBeenCalledWith({
        telefones: ['11999998888']
      });
    } finally {
      await server.close();
    }
  });

  it('deve retornar 202 no importar-leads com resultado do service', async () => {
    mocks.importLeadsBulk.mockResolvedValueOnce({
      accepted: true,
      total: 2,
      imported: 1,
      duplicatesInFile: 0,
      duplicatesInDb: 1,
      invalid: 0,
      correlationId: 'csv-abc',
      results: []
    });

    const server = await startServer();

    try {
      const response = await fetch(
        `${server.baseUrl}/api/prospeccao/importar-leads`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-internal-api-key': 'test-internal-key'
          },
          body: JSON.stringify({
            clienteId: 'cliente-1',
            itens: [{ telefone: '11999998888' }]
          })
        }
      );

      expect(response.status).toBe(202);
      const body = (await response.json()) as { correlationId: string };
      expect(body.correlationId).toBe('csv-abc');
      expect(mocks.importLeadsBulk).toHaveBeenCalledOnce();
    } finally {
      await server.close();
    }
  });

  it('deve retornar 400 no importar-leads quando service falhar', async () => {
    mocks.importLeadsBulk.mockRejectedValueOnce(
      new Error('lote excede limite de 2000 itens')
    );

    const server = await startServer();

    try {
      const response = await fetch(
        `${server.baseUrl}/api/prospeccao/importar-leads`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-internal-api-key': 'test-internal-key'
          },
          body: JSON.stringify({ itens: [{ telefone: '11999998888' }] })
        }
      );

      expect(response.status).toBe(400);
      const body = (await response.json()) as { accepted: boolean; error: string };
      expect(body.accepted).toBe(false);
      expect(body.error).toContain('lote excede limite');
    } finally {
      await server.close();
    }
  });
});
