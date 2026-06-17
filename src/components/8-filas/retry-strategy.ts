// src/components/8-filas/retry-strategy.ts

export class RetryStrategy {
  /**
   * Calcula o delay para retry exponencial.
   * Fórmula: delay = base * 2^(attempts - 1) + jitter
   */
  public static calculateBackoff(
    attempts: number,
    baseDelay: number
  ): number {
    const exponent = Math.max(0, attempts - 1);
    const delay = baseDelay * Math.pow(2, exponent);

    // Adiciona Jitter para evitar o "Thundering Herd Problem"
    const jitter = Math.random() * 1000;

    return delay + jitter;
  }
}
