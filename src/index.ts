/**
 * Klaus V2 - Ponto de entrada
 * Sistema SDR baseado em IA
 */

export * from './components/1-deteccao-intencao';
export * from './integrations/wasender';

import { QueueManager } from './components/8-filas/queue-manager';
import { logger } from './components/shared/logger';
import {
	configurarProcessor,
	iniciarServidor,
	wasenderConfig
} from './integrations/wasender';

if (wasenderConfig.PROCESSING_MODE === 'queue') {
	configurarProcessor({ queueManager: QueueManager.getInstance() });
} else {
	logger.warn('PROCESSING_MODE=direct requer OrquestradorKlaus configurado');
}

iniciarServidor();
