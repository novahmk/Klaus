// src/components/5-geracao-resposta/validator.ts
import { GeracaoInput } from './types';
import { CRITERIOS_VALIDACAO } from './constants';

export class ValidadorResposta {
  /**
   * Valida a qualidade da resposta gerada.
   *
   * @param resposta - Texto da resposta
   * @param _input - Contexto de geração (reservado para uso futuro)
   * @param minLength - Comprimento mínimo (cfg_ia_parametros.min_length; padrão: CRITERIOS_VALIDACAO.MIN_LENGTH)
   * @param maxLength - Comprimento máximo (cfg_ia_parametros.max_length; padrão: CRITERIOS_VALIDACAO.MAX_LENGTH)
   */
  static validar(
    resposta: string,
    _input?: GeracaoInput,
    minLength: number = CRITERIOS_VALIDACAO.MIN_LENGTH,
    maxLength: number = CRITERIOS_VALIDACAO.MAX_LENGTH
  ): number {
    let score = 100;

    if (resposta.length < minLength) score -= 30;
    if (resposta.length > maxLength) score -= 30; // Verboso
    if (!resposta.includes('?')) score -= 10; // Falta de CTA
    if (resposta.toLowerCase().includes('infelizmente')) score -= 20; // Tom negativo

    return Math.max(score, 0);
  }

  /**
   * Garante que a resposta não ultrapasse maxLength, cortando no último
   * limite de frase/palavra dentro do teto para evitar corte abrupto.
   *
   * @param resposta - Texto a truncar
   * @param maxLength - Limite máximo de caracteres (cfg_ia_parametros.max_length; padrão: CRITERIOS_VALIDACAO.MAX_LENGTH)
   * @param minLength - Mínimo para corte por frase (cfg_ia_parametros.min_length; padrão: CRITERIOS_VALIDACAO.MIN_LENGTH)
   */
  static truncar(
    resposta: string,
    maxLength: number = CRITERIOS_VALIDACAO.MAX_LENGTH,
    minLength: number = CRITERIOS_VALIDACAO.MIN_LENGTH
  ): string {
    if (resposta.length <= maxLength) return resposta;

    const corte = resposta.slice(0, maxLength);
    const ultimoPonto = Math.max(
      corte.lastIndexOf('. '),
      corte.lastIndexOf('! '),
      corte.lastIndexOf('? ')
    );
    if (ultimoPonto >= minLength) {
      return corte.slice(0, ultimoPonto + 1).trim();
    }
    const ultimoEspaco = corte.lastIndexOf(' ');
    return (ultimoEspaco > 0 ? corte.slice(0, ultimoEspaco) : corte).trim();
  }
}
