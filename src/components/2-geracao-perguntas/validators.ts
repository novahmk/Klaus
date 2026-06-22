/**
 * Validadores - Componente 2: Gerador de Perguntas
 * Klaus V2 - Componente 2
 */

import {
  ResultadoValidacaoPergunta,
  ResultadoSimilaridade,
  GeradorPerguntasOutput
} from './types';
import { PALAVRAS_FECHADAS, SIMILARIDADE_MAXIMA } from './constants';
import { logger } from '../shared/logger';

// Limites padrão de comprimento de pergunta (fallback quando ConfigIA não está disponível).
// Os valores dinâmicos são injetados via parâmetros de validarCompleto().
const COMPRIMENTO_PADRAO = { MINIMO: 5, MAXIMO: 500 };

export class ValidadorPergunta {
  /**
   * Valida uma pergunta completamente.
   *
   * @param pergunta - Texto da pergunta a validar
   * @param perguntasAnterior - Perguntas já feitas (para checar similaridade)
   * @param minLength - Comprimento mínimo em caracteres (padrão: cfg_ia_parametros.min_length)
   * @param maxLength - Comprimento máximo em caracteres (padrão: cfg_ia_parametros.max_length)
   */
  static validarCompleto(
    pergunta: string,
    perguntasAnterior: string[] = [],
    minLength: number = COMPRIMENTO_PADRAO.MINIMO,
    maxLength: number = COMPRIMENTO_PADRAO.MAXIMO
  ): ResultadoValidacaoPergunta {
    const erros: string[] = [];

    // Validação 1: Tamanho
    if (pergunta.length < minLength) {
      erros.push(`Pergunta muito curta (mínimo ${minLength} caracteres, tem ${pergunta.length})`);
    }
    if (pergunta.length > maxLength) {
      erros.push(`Pergunta muito longa (máximo ${maxLength} caracteres, tem ${pergunta.length})`);
    }

    // Validação 2: Termina com ?
    if (!pergunta.endsWith('?')) {
      erros.push('Pergunta deve terminar com "?"');
    }

    // Validação 3: É pergunta aberta
    if (this.ehPerguntaFechada(pergunta)) {
      erros.push('Pergunta parece ser fechada (sim/não). Deve ser aberta (O quê, Como, Qual, etc)');
    }

    // Validação 4: Sem placeholders
    if (this.temPlaceholders(pergunta)) {
      erros.push('Pergunta contém placeholders ou variáveis');
    }

    // Validação 5: Sem repetição excessiva
    const resultadoSimilaridade = this.calcularSimilaridades(pergunta, perguntasAnterior);
    if (resultadoSimilaridade.similaridade > SIMILARIDADE_MAXIMA * 100) {
      erros.push(
        `Pergunta muito similar a anterior (${Math.round(resultadoSimilaridade.similaridade)}% similaridade)`
      );
    }

    // Validação 6: Sem caracteres inválidos
    if (this.temCaracteresInvalidos(pergunta)) {
      erros.push('Pergunta contém caracteres inválidos');
    }

    return {
      valido: erros.length === 0,
      erros
    };
  }

  /**
   * Valida resultado da saída.
   *
   * @param resultado - Objeto a validar
   * @param minLength - Comprimento mínimo de pergunta (cfg_ia_parametros.min_length)
   * @param maxLength - Comprimento máximo de pergunta (cfg_ia_parametros.max_length)
   */
  static validarResultado(
    resultado: unknown,
    minLength?: number,
    maxLength?: number
  ): resultado is GeradorPerguntasOutput {
    if (!resultado || typeof resultado !== 'object') {
      return false;
    }

    const obj = resultado as Record<string, unknown>;

    // Validar pergunta
    if (typeof obj.pergunta !== 'string') {
      return false;
    }

    const validacaoPergunta = this.validarCompleto(obj.pergunta, [], minLength, maxLength);
    if (!validacaoPergunta.valido) {
      logger.warn(
        { erros: validacaoPergunta.erros },
        'Resultado falhou na validação de pergunta'
      );
      return false;
    }

    // Validar contextoEsperado
    if (typeof obj.contextoEsperado !== 'string' || obj.contextoEsperado.length === 0) {
      return false;
    }

    // Validar camada
    if (typeof obj.camada !== 'number' || ![1, 2, 3].includes(obj.camada)) {
      return false;
    }

    // Validar timestamp
    if (!(obj.timestamp instanceof Date)) {
      return false;
    }

    // Validar origem
    if (!['gpt', 'template'].includes(obj.origem as string)) {
      return false;
    }

    return true;
  }

  /**
   * Verifica se a pergunta é fechada (sim/não)
   */
  static ehPerguntaFechada(pergunta: string): boolean {
    const perguntaNorm = pergunta.toLowerCase().trim();

    // Verificar se começa com palavras que indicam pergunta fechada
    for (const palavra of PALAVRAS_FECHADAS) {
      if (perguntaNorm.startsWith(palavra)) {
        return true;
      }
    }

    // Verificar padrões de sim/não
    if (
      perguntaNorm.startsWith('é ') ||
      perguntaNorm.startsWith('são ') ||
      perguntaNorm.startsWith('está ') ||
      perguntaNorm.startsWith('estão ') ||
      perguntaNorm.startsWith('foi ') ||
      perguntaNorm.startsWith('tem ') ||
      perguntaNorm.startsWith('vai ')
    ) {
      return true;
    }

    // Verificar outros padrões de pergunta fechada
    // "Você [verbo simples]?" com vários tempos
    if (
      /^(você|ele|ela|eles|elas|a gente)\s+(gostou|gosta|prefere|quer|pode|consegue|já|precisa|tem|usa|faz|vai|vou|deve)\b/.test(perguntaNorm)
    ) {
      return true;
    }

    return false;
  }

  /**
   * Verifica se tem placeholders
   */
  static temPlaceholders(pergunta: string): boolean {
    const padroes = [
      /\{.*?\}/g, // {placeholder}
      /\$\{.*?\}/g, // ${placeholder}
      /\[.*?\]/g, // [placeholder]
      /{{.*?}}/g, // {{placeholder}}
      /<.*?>/g, // <placeholder>
      /\b(EMAIL|EMPRESA|DATA|HORA|LINK|URL|NOME_CLIENTE|ID_LEAD|CPF|CNPJ)\b/,
      /\b[A-Z]{3,}(?:_[A-Z0-9]+)*\b/
    ];

    for (const padrao of padroes) {
      if (padrao.test(pergunta)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Verifica caracteres inválidos
   */
  static temCaracteresInvalidos(pergunta: string): boolean {
    // Permitir: letras, números, pontuação comum, acentos, espaços
    const regex = /^[\p{L}\p{N}\s\-,.:;!?"'()]+$/u;
    return !regex.test(pergunta);
  }

  /**
   * Calcula similaridade entre perguntas usando similaridade de cosseno
   */
  static calcularSimilaridades(
    pergunta: string,
    perguntasAnteriores: string[]
  ): ResultadoSimilaridade {
    if (perguntasAnteriores.length === 0) {
      return { similaridade: 0 };
    }

    let maiorSimilaridade = 0;
    let perguntaSimilar: string | undefined;

    for (const anterior of perguntasAnteriores) {
      const similaridade = this.calcularSimilaridade(pergunta, anterior);
      if (similaridade > maiorSimilaridade) {
        maiorSimilaridade = similaridade;
        perguntaSimilar = anterior;
      }
    }

    return {
      similaridade: maiorSimilaridade,
      perguntaSimilar
    };
  }

  /**
   * Calcula similaridade de cosseno entre duas strings
   */
  private static calcularSimilaridade(str1: string, str2: string): number {
    const limpar = (texto: string): string[] =>
      texto
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .filter(palavra => palavra.length > 1);

    const s1 = limpar(str1);
    const s2 = limpar(str2);

    const conjunto = new Set([...s1, ...s2]);
    const v1: number[] = [];
    const v2: number[] = [];

    for (const word of Array.from(conjunto)) {
      v1.push(s1.filter(w => w === word).length);
      v2.push(s2.filter(w => w === word).length);
    }

    const ponto = v1.reduce((acc, val, i) => acc + val * v2[i], 0);
    const mag1 = Math.sqrt(v1.reduce((acc, val) => acc + val * val, 0));
    const mag2 = Math.sqrt(v2.reduce((acc, val) => acc + val * val, 0));

    if (mag1 === 0 || mag2 === 0) return 0;

    return (ponto / (mag1 * mag2)) * 100; // Retornar como percentual
  }

  /**
   * Valida entrada do gerador
   */
  static validarEntrada(
    tema: string,
    historico: unknown[],
    perguntasJaFeitas?: unknown[]
  ): { valido: boolean; erro?: string } {
    // Validar tema
    if (!tema || typeof tema !== 'string') {
      return { valido: false, erro: 'Tema inválido' };
    }

    if (tema.trim().length === 0) {
      return { valido: false, erro: 'Tema não pode estar vazio' };
    }

    if (tema.length > 500) {
      return { valido: false, erro: 'Tema muito longo' };
    }

    // Validar histórico
    if (!Array.isArray(historico) || historico.length === 0) {
      return { valido: false, erro: 'Histórico deve ser um array não-vazio' };
    }

    // Validar perguntas já feitas
    if (perguntasJaFeitas) {
      if (!Array.isArray(perguntasJaFeitas)) {
        return { valido: false, erro: 'Perguntas já feitas deve ser um array' };
      }

      for (const pergunta of perguntasJaFeitas) {
        if (typeof pergunta !== 'string') {
          return { valido: false, erro: 'Perguntas devem ser strings' };
        }
      }
    }

    return { valido: true };
  }

  /**
   * Normaliza uma pergunta para comparação
   */
  static normalizarPergunta(pergunta: string): string {
    return pergunta
      .toLowerCase()
      .trim()
      .replace(/[?!.,:;]/g, '')
      .replace(/\s+/g, ' ');
  }
}
