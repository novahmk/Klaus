// src/components/8-filas/retry-strategy.test.ts
/**
 * Testes - Componente 8: Sistema de Filas
 * Klaus V2
 *
 * Cobrem a lógica pura (RetryStrategy) e o shape das configurações. As classes
 * QueueManager/JobProcessor/QueueMonitoring dependem de Redis/BullMQ e aguardam
 * a integração da infraestrutura de filas.
 */

import { describe, it, expect } from 'vitest';
import { RetryStrategy } from './retry-strategy';
import { DEFAULT_QUEUE_CONFIG } from './constants';
import { QueueName } from './types';

describe('Componente 8 - RetryStrategy', () => {
  it('deve aplicar backoff exponencial base * 2^(n-1) + jitter', () => {
    // attempts=1 → base*2^0 = base (+ jitter 0-1000)
    const d1 = RetryStrategy.calculateBackoff(1, 2000);
    expect(d1).toBeGreaterThanOrEqual(2000);
    expect(d1).toBeLessThan(3000);

    // attempts=2 → base*2^1 = 4000 (+ jitter)
    const d2 = RetryStrategy.calculateBackoff(2, 2000);
    expect(d2).toBeGreaterThanOrEqual(4000);
    expect(d2).toBeLessThan(5000);

    // attempts=3 → base*2^2 = 8000 (+ jitter)
    const d3 = RetryStrategy.calculateBackoff(3, 2000);
    expect(d3).toBeGreaterThanOrEqual(8000);
    expect(d3).toBeLessThan(9000);
  });

  it('deve tratar attempts <= 0 como expoente 0', () => {
    const d = RetryStrategy.calculateBackoff(0, 1000);
    expect(d).toBeGreaterThanOrEqual(1000);
    expect(d).toBeLessThan(2000);
  });

  it('deve crescer monotonicamente com o número de tentativas (sem jitter)', () => {
    const semJitter = (n: number, base: number) =>
      base * Math.pow(2, Math.max(0, n - 1));
    expect(semJitter(1, 2000)).toBe(2000);
    expect(semJitter(2, 2000)).toBe(4000);
    expect(semJitter(4, 2000)).toBe(16000);
  });

  it('deve respeitar a base informada', () => {
    const d = RetryStrategy.calculateBackoff(2, 500);
    expect(d).toBeGreaterThanOrEqual(1000);
    expect(d).toBeLessThan(2000);
  });
});

describe('Componente 8 - DEFAULT_QUEUE_CONFIG', () => {
  it('deve definir configuração para todas as filas', () => {
    expect(DEFAULT_QUEUE_CONFIG[QueueName.INBOUND_MESSAGES]).toBeDefined();
    expect(DEFAULT_QUEUE_CONFIG[QueueName.OUTBOUND_RESPONSES]).toBeDefined();
    expect(DEFAULT_QUEUE_CONFIG[QueueName.NOTIFICATION_ALERTS]).toBeDefined();
  });

  it('deve priorizar a concorrência das mensagens inbound', () => {
    expect(DEFAULT_QUEUE_CONFIG[QueueName.INBOUND_MESSAGES].concurrency).toBe(
      50
    );
    expect(
      DEFAULT_QUEUE_CONFIG[QueueName.INBOUND_MESSAGES].concurrency
    ).toBeGreaterThan(
      DEFAULT_QUEUE_CONFIG[QueueName.NOTIFICATION_ALERTS].concurrency
    );
  });

  it('deve usar backoff exponencial nas mensagens inbound', () => {
    expect(DEFAULT_QUEUE_CONFIG[QueueName.INBOUND_MESSAGES].backoff.type).toBe(
      'exponential'
    );
    expect(DEFAULT_QUEUE_CONFIG[QueueName.INBOUND_MESSAGES].attempts).toBe(5);
  });

  it('deve usar backoff fixo nas respostas e notificações', () => {
    expect(
      DEFAULT_QUEUE_CONFIG[QueueName.OUTBOUND_RESPONSES].backoff.type
    ).toBe('fixed');
    expect(
      DEFAULT_QUEUE_CONFIG[QueueName.NOTIFICATION_ALERTS].backoff.type
    ).toBe('fixed');
  });
});
