// src/components/5-geracao-resposta/validator.ts
import { GeracaoInput } from './types';
import { CRITERIOS_VALIDACAO } from './constants';
import { ConfigIACompleta } from '../../modules/config-loader/ia-config-types';
import { DEFAULT_PARAMETROS, DEFAULT_VALIDACAO } from '../../modules/config-loader/ia-config-defaults';

export class ValidadorResposta {
  static validar(resposta: string, _input?: GeracaoInput, config?: ConfigIACompleta): number {
    const parametros = config?.parametros ?? DEFAULT_PARAMETROS;
    const validacao = config?.validacao ?? DEFAULT_VALIDACAO;

    let score = 100;

    if (resposta.length < parametros.tamanho_min_resposta) score += validacao.penalidade_tamanho_minimo;
    if (resposta.length > parametros.tamanho_max_resposta) score += validacao.penalidade_tamanho_maximo;

    if (parametros.usar_cta_obrigatorio && !resposta.includes('?')) {
      score += validacao.penalidade_sem_cta;
    }

    const respostaLower = resposta.toLowerCase();
    for (const palavra of validacao.palavras_bloqueadas) {
      if (respostaLower.includes(palavra.toLowerCase())) {
        score += validacao.penalidade_tom_negativo;
        break; // aplica penalidade apenas uma vez
      }
    }

    return Math.max(score, 0);
  }

  /**
   * Garante que a resposta não ultrapasse tamanho_max_resposta, cortando no
   * último limite de frase/palavra dentro do teto para evitar corte abrupto.
   */
  static truncar(resposta: string, config?: ConfigIACompleta): string {
    const max = config?.parametros.tamanho_max_resposta ?? CRITERIOS_VALIDACAO.MAX_LENGTH;
    const min = config?.parametros.tamanho_min_resposta ?? CRITERIOS_VALIDACAO.MIN_LENGTH;

    if (resposta.length <= max) return resposta;

    const corte = resposta.slice(0, max);
    const ultimoPonto = Math.max(
      corte.lastIndexOf('. '),
      corte.lastIndexOf('! '),
      corte.lastIndexOf('? ')
    );
    if (ultimoPonto >= min) {
      return corte.slice(0, ultimoPonto + 1).trim();
    }
    const ultimoEspaco = corte.lastIndexOf(' ');
    return (ultimoEspaco > 0 ? corte.slice(0, ultimoEspaco) : corte).trim();
  }

  /**
   * Retorna diagnóstico detalhado das penalidades aplicadas à resposta.
   */
  static diagnosticar(
    resposta: string,
    _input?: GeracaoInput,
    config?: ConfigIACompleta
  ): { score: number; penalidades: string[] } {
    const parametros = config?.parametros ?? DEFAULT_PARAMETROS;
    const validacao = config?.validacao ?? DEFAULT_VALIDACAO;

    let score = 100;
    const penalidades: string[] = [];

    if (resposta.length < parametros.tamanho_min_resposta) {
      score += validacao.penalidade_tamanho_minimo;
      penalidades.push(
        `Resposta muito curta (${resposta.length} < ${parametros.tamanho_min_resposta}): ${validacao.penalidade_tamanho_minimo}`
      );
    }

    if (resposta.length > parametros.tamanho_max_resposta) {
      score += validacao.penalidade_tamanho_maximo;
      penalidades.push(
        `Resposta muito longa (${resposta.length} > ${parametros.tamanho_max_resposta}): ${validacao.penalidade_tamanho_maximo}`
      );
    }

    if (parametros.usar_cta_obrigatorio && !resposta.includes('?')) {
      score += validacao.penalidade_sem_cta;
      penalidades.push(`Sem CTA (ausência de '?'): ${validacao.penalidade_sem_cta}`);
    }

    const respostaLower = resposta.toLowerCase();
    for (const palavra of validacao.palavras_bloqueadas) {
      if (respostaLower.includes(palavra.toLowerCase())) {
        score += validacao.penalidade_tom_negativo;
        penalidades.push(`Palavra bloqueada '${palavra}': ${validacao.penalidade_tom_negativo}`);
        break;
      }
    }

    return { score: Math.max(score, 0), penalidades };
  }
}
