// src/components/7-orquestracao/error-handler.ts

export class ErrorHandler {
  static async retry<T>(
    fn: () => Promise<T>,
    tentativas: number,
    delay: number
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (tentativas <= 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return this.retry(fn, tentativas - 1, delay * 2);
    }
  }

  static getFallbackResponse(intencao?: string): string {
    const fallbacks: Record<string, string> = {
      QUER_AGENDAR:
        'Entendi que você deseja agendar. No momento nosso sistema está instável, mas já vou te conectar com um atendente.',
      default:
        'Desculpe, tive um problema técnico ao processar sua mensagem. Pode repetir, por favor?'
    };
    return fallbacks[intencao || 'default'] || fallbacks['default'];
  }
}
