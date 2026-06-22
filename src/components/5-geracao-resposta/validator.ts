// src/components/5-geracao-resposta/validator.ts
import { GeracaoInput } from './types';
import { ConfigIAValidacao } from '../../modules/ia-config-loader/types';
import { DEFAULT_VALIDACAO } from '../../modules/ia-config-loader/defaults';

export class ValidadorResposta {
  /**
   * Valida a resposta gerada e retorna um score de 0–100.
   * Aceita ConfigIAValidacao para usar parâmetros dinâmicos do Supabase.
   * Fallback para DEFAULT_VALIDACAO quando config não é fornecida.
   */
  static validar(
    resposta: string,
    config?: ConfigIAValidacao | GeracaoInput
  ): number {
    // Detecta se foi passado um GeracaoInput (legado) ou ConfigIAValidacao
    const validacao = isConfigIAValidacao(config)
      ? config
      : DEFAULT_VALIDACAO;

    let score = 100;

    if (resposta.length < validacao.min_length) score -= 30;
    if (resposta.length > validacao.max_length) score -= 30; // Verboso
    if (!resposta.includes('?')) score -= 10; // Falta de CTA
    if (resposta.toLowerCase().includes('infelizmente')) score -= 20; // Tom negativo

    return Math.max(score, 0);
  }

  /**
   * Garante que a resposta não ultrapasse max_length, cortando no último
   * limite de frase/palavra dentro do teto para evitar corte abrupto.
   * Aceita ConfigIAValidacao para usar parâmetros dinâmicos do Supabase.
   */
  static truncar(resposta: string, config?: ConfigIAValidacao): string {
    const validacao = config ?? DEFAULT_VALIDACAO;
    const max = validacao.max_length;
    if (resposta.length <= max) return resposta;

    const corte = resposta.slice(0, max);
    const ultimoPonto = Math.max(
      corte.lastIndexOf('. '),
      corte.lastIndexOf('! '),
      corte.lastIndexOf('? ')
    );
    if (ultimoPonto >= validacao.min_length) {
      return corte.slice(0, ultimoPonto + 1).trim();
    }
    const ultimoEspaco = corte.lastIndexOf(' ');
    return (ultimoEspaco > 0 ? corte.slice(0, ultimoEspaco) : corte).trim();
  }
}

/**
 * Type guard: distingue ConfigIAValidacao de GeracaoInput (legado).
 */
function isConfigIAValidacao(
  value: unknown
): value is ConfigIAValidacao {
  if (!value || typeof value !== 'object') return false;
  return (
    'min_length' in value &&
    'max_length' in value &&
    'min_score' in value &&
    'max_retries' in value
  );
}
