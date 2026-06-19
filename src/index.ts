/**
 * Klaus V2 - Ponto de entrada
 * Sistema SDR baseado em IA
 */

export * from './components/1-deteccao-intencao';
export * from './integrations/wasender';
export * from './integrations/openai';

import { QueueManager } from './components/8-filas/queue-manager';
import { JobProcessor } from './components/8-filas/job-processor';
import { logger } from './components/shared/logger';
import {
	configurarProcessor,
	criarOrquestradorWasender,
	iniciarServidor,
	wasenderConfig
} from './integrations/wasender';

const orquestrador = criarOrquestradorWasender();

if (wasenderConfig.PROCESSING_MODE === 'queue') {
	const queueManager = QueueManager.getInstance();
	configurarProcessor({ queueManager });
	new JobProcessor(orquestrador, queueManager).start();
	logger.info('Processor WASender configurado em modo queue');
} else {
	configurarProcessor({ orquestrador });
	logger.info('Processor WASender configurado em modo direct');
}

iniciarServidor();
