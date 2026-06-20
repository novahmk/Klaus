import express from 'express';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  startPing: vi.fn(),
  runAllChecks: vi.fn(() => Promise.resolve({ overall: 'ok', results: [], ts: new Date().toISOString() })),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
  loggerDebug: vi.fn(),
  loggerFatal: vi.fn()
}));

vi.mock('./core', async () => {
  const actual = await vi.importActual<typeof import('./core')>('./core');
  return {
    ...actual,
    startPing: mocks.startPing,
    runAllChecks: mocks.runAllChecks
  };
});

vi.mock('../../components/shared/logger', () => ({
  logger: {
    info: mocks.loggerInfo,
    warn: mocks.loggerWarn,
    error: mocks.loggerError,
    debug: mocks.loggerDebug,
    fatal: mocks.loggerFatal
  }
}));

describe('health ping compatibility', () => {
  let server: ReturnType<typeof express.Application['listen']> | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server?.close(() => resolve()));
      server = null;
    }
  });

  it('deve responder /health/ping com status ok', async () => {
    const { attach } = await import('./index');
    const app = express();
    attach(app);

    server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server?.once('listening', () => resolve()));

    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    const response = await fetch(`http://127.0.0.1:${port}/health/ping`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });
});
