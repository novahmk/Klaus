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
import { attachGlobalHandlers } from './infra/health';
import { iniciarConfigLoader } from './modules/config-loader';
import { iniciarFollowupScheduler } from './modules/followup/scheduler';
import { iniciarMetricsCron } from './modules/metrics/cron';
import {
	configurarProcessor,
	criarOrquestradorWasender,
	iniciarServidor,
	wasenderConfig
} from './integrations/wasender';

attachGlobalHandlers();

const orquestrador = criarOrquestradorWasender();

async function inicializar(): Promise<void> {
	if (wasenderConfig.PROCESSING_MODE === 'queue') {
		try {
			const queueManager = QueueManager.getInstance();
			// Verifica conectividade com Redis antes de comprometer o modo fila.
			const pong = await queueManager.healthPing();
			if (pong !== 'PONG') {
				throw new Error(`Redis respondeu inesperado: ${pong}`);
			}
			configurarProcessor({ queueManager });
			new JobProcessor(orquestrador, queueManager).start();
			logger.info('Processor WASender configurado em modo queue');
		} catch (erro) {
			// Fallback de resiliência: se a fila/Redis estiver indisponível na
			// inicialização, degrada para processamento direto em vez de derrubar
			// todo o atendimento.
			logger.error(
				{ erro: (erro as Error).message },
				'Fila indisponível na inicialização — fallback para modo direct'
			);
			// Alterna o modo efetivo para que o processor use o caminho direto.
			wasenderConfig.PROCESSING_MODE = 'direct';
			configurarProcessor({ orquestrador });
			logger.warn('Processor WASender configurado em modo direct (fallback)');
		}
	} else {
		configurarProcessor({ orquestrador });
		logger.info('Processor WASender configurado em modo direct');
	}


	// Sprint 1: Config Loader (não-bloqueante, desligável por flag)
	if (process.env.CONFIG_LOADER_ENABLED === 'true') {
		void iniciarConfigLoader();
	}

	// Sprint 4: Follow-up scheduler (não-bloqueante, desligável por flag)
	iniciarFollowupScheduler();

	// Sprint 5: Métricas diárias (não-bloqueante, desligável por flag)
	iniciarMetricsCron();

	iniciarServidor();
}

void inicializar();
