// src/components/8-filas/types.ts
import { Intencao } from '../1-deteccao-intencao/types';

export enum QueueName {
  INBOUND_MESSAGES = 'inbound_messages',
  OUTBOUND_RESPONSES = 'outbound_responses',
  NOTIFICATION_ALERTS = 'notification_alerts',
  DEAD_LETTER = 'dead_letter'
}

export interface KlausJobPayload {
  leadId: string;
  clienteId: string;
  mensagem: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface JobResult {
  success: boolean;
  intencaoDetectada?: Intencao;
  respostaGerada?: string;
  error?: string;
  processingTime: number;
}

export interface QueueConfig {
  concurrency: number;
  attempts: number;
  backoff: {
    type: 'exponential' | 'fixed';
    delay: number;
  };
}
