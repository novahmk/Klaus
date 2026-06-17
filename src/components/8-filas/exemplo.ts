// src/components/8-filas/exemplo.ts
/**
 * Exemplo de uso do Componente 8 - Sistema de Filas (BullMQ)
 * Klaus V2
 *
 * NOTA: Requer um Redis ativo (BullMQ). Enquanto a infraestrutura de filas
 * não estiver disponível, use como referência de uso.
 */

import { QueueManager } from './queue-manager';
import { JobProcessor } from './job-processor';
import { QueueMonitoring } from './monitoring';
import { QueueName, KlausJobPayload } from './types';
import { OrquestradorKlaus } from '../7-orquestracao/orchestrator';

async function exemploFilas(orquestrador: OrquestradorKlaus) {
  // 1. Inicializa o gerenciador de filas (singleton)
  const queueManager = QueueManager.getInstance();

  // 2. Inicia os workers que consomem as filas
  const processor = new JobProcessor(orquestrador);
  processor.start();

  // 3. Enfileira uma mensagem inbound
  const payload: KlausJobPayload = {
    leadId: 'lead-456',
    clienteId: 'cliente-123',
    mensagem: 'Quero saber mais sobre o plano premium',
    timestamp: new Date()
  };

  const job = await queueManager.addJob(
    QueueName.INBOUND_MESSAGES,
    payload,
    10 // prioridade alta (lead quente)
  );

  console.log(`Job enfileirado: ${job.id}`);

  // 4. Consulta métricas das filas
  const monitoring = new QueueMonitoring(queueManager);
  const metrics = await monitoring.getMetrics();
  console.log('Métricas das filas:', metrics);
}

// Este exemplo deve ser chamado com um OrquestradorKlaus configurado:
// exemploFilas(meuOrquestrador);

export { exemploFilas };
