/**
 * Sistema de fallback por palavras-chave
 * Klaus V2 - Componente 1
 */

import { Intencao, FallbackAnalysisResult, MensagemHistorico } from './types';
import { FALLBACK_KEYWORDS } from './constants';

export class AnalisadorFallback {
  /**
   * Analisa intenção usando palavras-chave
   */
  static analisar(mensagem: string, historico?: MensagemHistorico[]): FallbackAnalysisResult | null {
    if (!mensagem || mensagem.trim().length === 0) {
      return null;
    }

    // Normalizar mensagem
    const mensagemNormalizada = mensagem.toLowerCase().trim();

    // Se a mensagem é muito curta e vaga, pode ser NAO_RESPONDEU
    if (this.ehRespostaMuitoVaga(mensagemNormalizada)) {
      return {
        intencao: Intencao.NAO_RESPONDEU,
        confianca: 75,
        motivo: 'Resposta muito vaga ou incompleta',
        regra: 'RESPOSTA_VAGA'
      };
    }

    // Verificar padrões de frases completas com alta prioridade
    const padraoFrase = this.detectarFraseCompleta(mensagemNormalizada);
    if (padraoFrase) {
      return padraoFrase;
    }

    // Buscar a melhor correspondência por palavras-chave
    let melhorCorrespondencia: { intencao: Intencao; confianca: number; regra: string } | null = null;
    let contadorMatches = 0;

    for (const [intencao, regex] of Object.entries(FALLBACK_KEYWORDS)) {
      const matches = (mensagemNormalizada.match(regex) || []).length;

      if (matches > 0) {
        contadorMatches += matches;

        // Calcular confiança baseada no número de correspondências
        let confianca = Math.min(90, 50 + matches * 10);

        // Aumentar confiança se encontrado no final da mensagem (decisão mais recente)
        if (this.ehNoFinal(mensagemNormalizada, regex)) {
          confianca += 10;
        }

        // Se é uma correspondência melhor que a atual
        if (!melhorCorrespondencia || confianca > melhorCorrespondencia.confianca) {
          melhorCorrespondencia = {
            intencao: intencao as Intencao,
            confianca,
            regra: `KEYWORDS_MATCH_${matches}`
          };
        }
      }
    }

    // Se não encontrou correspondência, retornar NAO_RESPONDEU com baixa confiança
    if (!melhorCorrespondencia) {
      return {
        intencao: Intencao.NAO_RESPONDEU,
        confianca: 40,
        motivo: 'Nenhuma palavra-chave de intenção identificada',
        regra: 'NO_KEYWORDS_MATCH'
      };
    }

    // Considerar histórico para contextualizar
    const contextoHistorico = this.analisarContextoHistorico(historico);
    
    if (contextoHistorico) {
      // Se o histórico sugere uma intenção diferente, reduzir confiança
      if (contextoHistorico.intencao !== melhorCorrespondencia.intencao) {
        melhorCorrespondencia.confianca -= 10;
      } else {
        // Se o histórico confirma a intenção, aumentar confiança
        melhorCorrespondencia.confianca += 5;
      }
    }

    // Normalizar confiança
    melhorCorrespondencia.confianca = Math.max(0, Math.min(100, melhorCorrespondencia.confianca));

    return {
      intencao: melhorCorrespondencia.intencao,
      confianca: melhorCorrespondencia.confianca,
      motivo: `Análise por palavras-chave detectou: ${this.descreverIntencao(melhorCorrespondencia.intencao)}`,
      regra: melhorCorrespondencia.regra
    };
  }

  /**
   * Verifica se a resposta é muito vaga
   */
  private static ehRespostaMuitoVaga(mensagem: string): boolean {
    const respostasVagas = ['ok', 'tá', 'sim', 'não', 'blz', 'vlw', '...', 'sei'];
    return respostasVagas.some(vaga => mensagem === vaga || mensagem === vaga + '.');
  }

  /**
   * Detecta frases completas com alta confiança
   */
  private static detectarFraseCompleta(mensagem: string): FallbackAnalysisResult | null {
    // Padrões de frases completas prioritários
    const padroes: Array<{
      regex: RegExp;
      intencao: Intencao;
      confianca: number;
    }> = [
      // NAO_INTERESSADO - alta prioridade
      {
        regex: /não (tenho |temos )?interesse|não estou interessado|não me interessa/i,
        intencao: Intencao.NAO_INTERESSADO,
        confianca: 90
      },
      // DEMONSTRA_INTERESSE - frases com advérbios
      {
        regex: /(muito|super|bastante|bem|realmente) (interessante|interessado|bom|legal|top|ótimo|excelente|perfeito)/i,
        intencao: Intencao.DEMONSTRA_INTERESSE,
        confianca: 85
      },
      // QUER_AGENDAR - frases específicas
      {
        regex: /gostaria de agendar|podemos agendar|pode agendar|quer agendar/i,
        intencao: Intencao.QUER_AGENDAR,
        confianca: 90
      }
    ];

    for (const padrao of padroes) {
      if (padrao.regex.test(mensagem)) {
        return {
          intencao: padrao.intencao,
          confianca: padrao.confianca,
          motivo: `Padrão de frase detectado: ${this.descreverIntencao(padrao.intencao)}`,
          regra: 'PHRASE_PATTERN'
        };
      }
    }

    return null;
  }

  /**
   * Verifica se a correspondência está no final da mensagem
   */
  private static ehNoFinal(mensagem: string, regex: RegExp): boolean {
    const match = mensagem.match(regex);
    if (!match) return false;

    const ultimaOcorrencia = match[match.length - 1];
    const posicao = mensagem.lastIndexOf(ultimaOcorrencia);
    const percentualFinal = (mensagem.length - posicao) / mensagem.length;

    return percentualFinal < 0.2; // Menos de 20% do final
  }

  /**
   * Analisa contexto do histórico
   */
  private static analisarContextoHistorico(
    historico?: MensagemHistorico[]
  ): { intencao: Intencao; confianca: number } | null {
    if (!historico || historico.length === 0) {
      return null;
    }

    // Analisar as últimas 3 mensagens do lead
    const mensagensLead = historico
      .filter(m => m.papel === 'lead')
      .slice(-3);

    if (mensagensLead.length === 0) {
      return null;
    }

    let contagemIntencoes: Record<string, number> = {};

    for (const msg of mensagensLead) {
      const resultado = this.analisar(msg.conteudo);
      if (resultado) {
        contagemIntencoes[resultado.intencao] = (contagemIntencoes[resultado.intencao] || 0) + 1;
      }
    }

    // Encontrar intenção mais frequente
    let intencaoMaisFrequente: Intencao | null = null;
    let contagem = 0;

    for (const [intencao, cnt] of Object.entries(contagemIntencoes)) {
      if (cnt > contagem) {
        intencaoMaisFrequente = intencao as Intencao;
        contagem = cnt;
      }
    }

    if (!intencaoMaisFrequente) {
      return null;
    }

    return {
      intencao: intencaoMaisFrequente,
      confianca: Math.min(80, 50 + contagem * 20)
    };
  }

  /**
   * Descreve uma intenção
   */
  private static descreverIntencao(intencao: Intencao): string {
    const descricoes: Record<Intencao, string> = {
      [Intencao.QUER_AGENDAR]: 'desejo de agendar',
      [Intencao.QUER_MAIS_INFO]: 'pedido de mais informações',
      [Intencao.TEM_OBJECAO]: 'objeção',
      [Intencao.DEMONSTRA_INTERESSE]: 'demonstração de interesse',
      [Intencao.NAO_INTERESSADO]: 'falta de interesse',
      [Intencao.NAO_RESPONDEU]: 'falta de resposta adequada'
    };

    return descricoes[intencao];
  }
}
