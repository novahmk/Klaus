import { describe, expect, it } from 'vitest';
import { runAllChecks } from './core';
import { HealthCheck } from './types';

describe('health core', () => {
  it('retorna overall ok quando todos checks passam', async () => {
    const checks: HealthCheck[] = [
      { name: 'db', fn: async () => ({ detail: 'ok' }) },
      { name: 'redis', fn: async () => ({ detail: 'ok' }) }
    ];

    const report = await runAllChecks(checks);

    expect(report.overall).toBe('ok');
    expect(report.results).toHaveLength(2);
    expect(report.results.every((r) => r.status === 'ok')).toBe(true);
  });

  it('retorna overall degraded quando parte dos checks falha', async () => {
    const checks: HealthCheck[] = [
      { name: 'db', fn: async () => ({ detail: 'ok' }) },
      {
        name: 'redis',
        fn: async () => {
          throw new Error('falha');
        }
      }
    ];

    const report = await runAllChecks(checks);

    expect(report.overall).toBe('degraded');
    expect(report.results.some((r) => r.status === 'fail')).toBe(true);
  });
});
