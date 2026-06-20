// src/components/5-geracao-resposta/validator.ts
import { GeracaoInput } from './types';
import { CRITERIOS_VALIDACAO } from './constants';

export class ValidadorResposta {
  static validar(resposta: string, _input?: GeracaoInput): number {
    let score = 100;

    if (resposta.length < CRITERIOS_VALIDACAO.MIN_LENGTH) score -= 30;
    if (resposta.length > CRITERIOS_VALIDACAO.MAX_LENGTH) score -= 30; // Verboso
    if (!resposta.includes('?')) score -= 10; // Falta de CTA
    if (resposta.toLowerCase().includes('infelizmente')) score -= 20; // Tom negativo

    return Math.max(score, 0);
  }

  /**
   * Garante que a resposta não ultrapasse MAX_LENGTH, cortando no último
   * limite de frase/palavra dentro do teto para evitar corte abrupto.
   */
  static truncar(resposta: string): string {
    const max = CRITERIOS_VALIDACAO.MAX_LENGTH;
    if (resposta.length <= max) return resposta;

    const corte = resposta.slice(0, max);
    const ultimoPonto = Math.max(
      corte.lastIndexOf('. '),
      corte.lastIndexOf('! '),
      corte.lastIndexOf('? ')
    );
    if (ultimoPonto >= CRITERIOS_VALIDACAO.MIN_LENGTH) {
      return corte.slice(0, ultimoPonto + 1).trim();
    }
    const ultimoEspaco = corte.lastIndexOf(' ');
    return (ultimoEspaco > 0 ? corte.slice(0, ultimoEspaco) : corte).trim();
  }
}
