import { Express } from 'express';
import { logger } from '../../components/shared/logger';
import { healthConfig } from './config';
import { pingChecks, fullChecks } from './checks';
import {
  attachGlobalHandlers,
  healthMiddleware,
  runAllChecks,
  startPing,
  stopPing
} from './core';

export function attach(expressApp: Express): void {
  expressApp.get(healthConfig.healthRoute, healthMiddleware(fullChecks));

  startPing(pingChecks, healthConfig.pingInterval);

  void runAllChecks(pingChecks).then((report) => {
    if (report.overall !== 'ok') {
      logger.warn(
        {
          failed: report.results
            .filter((r) => r.status === 'fail')
            .map((r) => r.name)
        },
        'Inicializando com sistemas degradados'
      );
    }
  });

  logger.info(
    {
      route: healthConfig.healthRoute,
      pingSec: healthConfig.pingInterval / 1000
    },
    'Health attach concluído'
  );
}

export { logger, attachGlobalHandlers, stopPing };
export * from './types';
export * from './core';
export * from './config';
