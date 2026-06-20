import { Request, Response } from 'express';
import { logger } from '../../components/shared/logger';
import { healthConfig } from './config';
import {
  CheckResult,
  HealthCheck,
  HealthReport,
  OverallStatus,
  RunAllChecksOptions
} from './types';

let pingIntervalHandle: NodeJS.Timeout | null = null;
let lastPingOverall: OverallStatus | null = null;
let globalHandlersAttached = false;

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export async function runCheck(
  check: HealthCheck,
  defaultTimeout = healthConfig.defaultTimeout
): Promise<CheckResult> {
  const start = Date.now();
  try {
    const result = await Promise.race([
      check.fn(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('timeout')), check.timeout ?? defaultTimeout);
      })
    ]);

    const ms = Date.now() - start;
    if (result && result.skipped) {
      return {
        name: check.name,
        status: 'skipped',
        ms,
        detail: result.detail
      };
    }

    return {
      name: check.name,
      status: 'ok',
      ms,
      detail: result?.detail
    };
  } catch (err) {
    const ms = Date.now() - start;
    const error = toErrorMessage(err);
    logger.error({ check: check.name, ms, error }, 'Health check falhou');

    return {
      name: check.name,
      status: 'fail',
      ms,
      error
    };
  }
}

export async function runAllChecks(
  checks: HealthCheck[],
  options?: RunAllChecksOptions
): Promise<HealthReport> {
  const results = await Promise.all(
    checks.map((check) => runCheck(check, options?.defaultTimeout))
  );

  const failed = results.filter((r) => r.status === 'fail');
  const runnable = results.filter((r) => r.status !== 'skipped');

  let overall: OverallStatus = 'ok';
  if (failed.length > 0) {
    overall = runnable.length > 0 && failed.length === runnable.length
      ? 'down'
      : 'degraded';
  }

  return {
    overall,
    results,
    ts: new Date().toISOString()
  };
}

function logPingTransition(report: HealthReport): void {
  const failedChecks = report.results
    .filter((r) => r.status === 'fail')
    .map((r) => r.name);

  if (lastPingOverall === report.overall) {
    if (report.overall === 'ok') {
      logger.debug({ systems: report.results.map((r) => r.name) }, 'Health ping OK');
    }
    return;
  }

  if (report.overall === 'ok') {
    logger.info('HEALTH recuperado para OK');
  } else if (report.overall === 'down') {
    logger.fatal({ failed: failedChecks }, 'Sistema DOWN detectado no ping');
  } else {
    logger.warn({ failed: failedChecks }, 'Sistema DEGRADADO detectado no ping');
  }

  lastPingOverall = report.overall;
}

export function startPing(
  checks: HealthCheck[],
  intervalMs = healthConfig.pingInterval
): void {
  if (pingIntervalHandle) clearInterval(pingIntervalHandle);

  logger.info({ intervalSec: intervalMs / 1000 }, 'Health ping iniciado');

  pingIntervalHandle = setInterval(() => {
    void runAllChecks(checks)
      .then(logPingTransition)
      .catch((err) => {
        logger.error({ error: toErrorMessage(err) }, 'Erro no loop de health ping');
      });
  }, intervalMs);

  pingIntervalHandle.unref();
}

export function stopPing(): void {
  if (pingIntervalHandle) {
    clearInterval(pingIntervalHandle);
    pingIntervalHandle = null;
  }
  lastPingOverall = null;
}

export function healthMiddleware(checks: HealthCheck[]) {
  return async (_req: Request, res: Response): Promise<void> => {
    const report = await runAllChecks(checks);
    const status = report.overall === 'ok' ? 200 : report.overall === 'degraded' ? 207 : 503;
    res.status(status).json(report);
  };
}

export function attachGlobalHandlers(): void {
  if (globalHandlersAttached) return;
  globalHandlersAttached = true;

  process.on('uncaughtException', (err) => {
    logger.fatal(
      {
        error: err.message,
        stack: err.stack?.split('\n').slice(0, 4)
      },
      'uncaughtException'
    );
  });

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason: String(reason) }, 'unhandledRejection');
  });

  process.on('SIGTERM', () => {
    logger.info('SIGTERM recebido, encerrando health ping');
    stopPing();
  });
}
