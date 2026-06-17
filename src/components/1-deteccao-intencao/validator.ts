/**
 * Validador de respostas do componente de detecção de intenção
 * Klaus V2 - Componente 1
 */

import { DeteccaoIntencaoResult, Intencao } from './types';
import { CONFIDENCE_RANGE } from './constants';
import { mapearIntencaoString } from './prompts';

export class ValidadorIntencao {
  /**
   * Valida um resultado de detecção de intenção
   */
  static validarResultado(resultado: unknown): resultado is DeteccaoIntencaoResult {
    if (!resultado || typeof resultado !== 'object') {
      return false;
    }

    const obj = resultado as Record<string, unknown>;

    // Validar intencao
    if (typeof obj.intencao !== 'string' || !Object.values(Intencao).includes(obj.intencao as Intencao)) {
      return false;
    }

    // Validar confianca
    if (typeof obj.confianca !== 'number' || obj.confianca < CONFIDENCE_RANGE.MIN || obj.confianca > CONFIDENCE_RANGE.MAX) {
      return false;
    }

    // Validar motivo
    if (typeof obj.motivo !== 'string' || obj.motivo.trim().length === 0) {
      return false;
    }

    // Validar timestamp
    if (!(obj.timestamp instanceof Date)) {
      return false;
    }

    // Validar origem
    if (typeof obj.origem !== 'string' || !['gpt', 'fallback', 'cache'].includes(obj.origem)) {
      return false;
    }

    return true;
  }

  /**
   * Valida resposta JSON do GPT
   */
  static validarRespostaGpt(resposta: string): { valido: boolean; dados?: Record<string, unknown>; erro?: string } {
    try {
      const jsonMatch = resposta.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          valido: false,
          erro: 'Nenhum JSON encontrado na resposta'
        };
      }

      const dados = JSON.parse(jsonMatch[0]);

      // Validar estrutura mínima
      if (!dados.intencao || typeof dados.confianca !== 'number' || !dados.motivo) {
        return {
          valido: false,
          erro: 'Resposta não contém campos obrigatórios'
        };
      }

      // Validar e normalizar intenção
      const intencaoMapeada = mapearIntencaoString(dados.intencao);
      if (!intencaoMapeada) {
        return {
          valido: false,
          erro: `Intenção inválida: ${dados.intencao}`
        };
      }

      // Validar confiança
      const confianca = Number(dados.confianca);
      if (isNaN(confianca) || confianca < CONFIDENCE_RANGE.MIN || confianca > CONFIDENCE_RANGE.MAX) {
        return {
          valido: false,
          erro: `Confiança fora do intervalo: ${confianca}`
        };
      }

      // Normalizar e retornar
      return {
        valido: true,
        dados: {
          intencao: intencaoMapeada,
          confianca,
          motivo: String(dados.motivo).substring(0, 500)
        }
      };
    } catch (erro) {
      return {
        valido: false,
        erro: `Erro ao parsear JSON: ${erro instanceof Error ? erro.message : String(erro)}`
      };
    }
  }

  /**
   * Valida entrada do detector
   */
  static validarEntrada(mensagem: string, historico?: unknown[], contexto?: unknown): { valido: boolean; erro?: string } {
    // Validar mensagem
    if (!mensagem || typeof mensagem !== 'string') {
      return { valido: false, erro: 'Mensagem inválida ou vazia' };
    }

    if (mensagem.trim().length === 0) {
      return { valido: false, erro: 'Mensagem não pode estar vazia' };
    }

    if (mensagem.length > 10000) {
      return { valido: false, erro: 'Mensagem muito longa (máximo 10000 caracteres)' };
    }

    // Validar histórico (se fornecido)
    if (historico) {
      if (!Array.isArray(historico)) {
        return { valido: false, erro: 'Histórico deve ser um array' };
      }

      for (const item of historico) {
        if (!item || typeof item !== 'object') {
          return { valido: false, erro: 'Item do histórico inválido' };
        }
      }
    }

    // Validar contexto (se fornecido)
    if (contexto) {
      if (typeof contexto !== 'object') {
        return { valido: false, erro: 'Contexto deve ser um objeto' };
      }
    }

    return { valido: true };
  }

  /**
   * Normaliza confiança para intervalo 0-100
   */
  static normalizarConfianca(valor: number): number {
    return Math.max(CONFIDENCE_RANGE.MIN, Math.min(CONFIDENCE_RANGE.MAX, Math.round(valor)));
  }
}
