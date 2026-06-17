// src/integrations/wasender/exemplo.ts
/**
 * Exemplo de wiring do pilar de Recebimento (WASenderAPI) com o restante do Klaus V2.
 *
 * Demonstra os dois modos:
 *  - PROCESSING_MODE=queue  → enfileira no Componente 8 (QueueManager)
 *  - PROCESSING_MODE=direct → chama o Orquestrador (Componente 7) diretamente
 *
 * NOTA: requer Redis/PostgreSQL/WASenderAPI configurados para rodar de fato.
 */

import { wasenderConfig } from './config';
import { configurarProcessor } from './processor';
import { iniciarServidor } from './webhook-server';
import { QueueManager } from '../../components/8-filas/queue-manager';

function bootstrap(): void {
  if (wasenderConfig.PROCESSING_MODE === 'queue') {
    // Modo fila: o webhook enfileira INBOUND; o JobProcessor (Comp. 8)
    // consome e aciona o Orquestrador de forma assíncrona.
    const queueManager = QueueManager.getInstance();
    configurarProcessor({ queueManager });
  } else {
    // Modo direto: injete aqui uma instância de OrquestradorKlaus já configurada.
    // configurarProcessor({ orquestrador: meuOrquestrador });
    console.warn(
      '[exemplo] PROCESSING_MODE=direct requer um OrquestradorKlaus injetado.'
    );
  }

  iniciarServidor();
}

// Descomente para executar como entrypoint:
// bootstrap();

export { bootstrap };
