/**
 * Logger centralizado com Pino
 * Klaus V2 - Componente Compartilhado
 */

import pino from 'pino';

// Criar instância global do logger
const logger = 
  process.env.NODE_ENV === 'test'
    ? pino({ level: 'silent' }) // Silencioso em testes
    : pino({
        level: process.env.LOG_LEVEL || 'info'
      });

export { logger };
