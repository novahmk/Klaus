// src/components/5-geracao-resposta/prompts.ts
import { INSTRUCOES_TOM } from './constants';
import { GeracaoInput } from './types';
import { ConfigIA } from '../../modules/ia-config-loader/types';

export class PromptBuilder {
  /**
   * Constrói o prompt do sistema.
   * Quando ConfigIA é fornecida, usa tom_voz e regras dinâmicos do Supabase.
   * Fallback para lógica baseada em cargo quando config não está disponível.
   */
  static build(input: GeracaoInput, config?: ConfigIA): string {
    const tom = config
      ? this.getTomByConfig(input.contextoLead.cargo, config)
      : this.getTomByCargo(input.contextoLead.cargo);

    const regras = config
      ? this.buildRegrasFromConfig(config)
      : this.buildRegrasDefault(input);

    return `
Você é o Klaus, um assistente de vendas de elite.

OBJETIVO: Responder a uma objeção de ${input.tipoObjecao} de forma persuasiva.

CONTEXTO DO LEAD:
Cargo: ${input.contextoLead.cargo}
Nicho: ${input.contextoLead.nicho}
Estágio: ${input.contextoLead.estagio}

BASE DE CONHECIMENTO:
${JSON.stringify(input.baseConhecimento)}

TOM DE VOZ: ${tom}

OBJEÇÃO DO LEAD: "${input.objecao}"

REGRAS:
${regras}
`;
  }

  /**
   * Determina o tom de voz a partir da ConfigIATomVoz e do cargo do lead.
   */
  private static getTomByConfig(cargo: string, config: ConfigIA): string {
    const c = cargo.toLowerCase();
    if (c.includes('ceo') || c.includes('diretor')) {
      return (
        config.tom_voz.tom_executivo ||
        INSTRUCOES_TOM.EXECUTIVO
      );
    }
    if (c.includes('eng') || c.includes('cto')) {
      return (
        config.tom_voz.tom_tecnico ||
        INSTRUCOES_TOM.TECNICO
      );
    }
    return (
      config.tom_voz.tom_suporte ||
      INSTRUCOES_TOM.OPERACIONAL
    );
  }

  /**
   * Fallback: determina tom de voz apenas pelo cargo (sem config dinâmica).
   */
  private static getTomByCargo(cargo: string): string {
    const c = cargo.toLowerCase();
    if (c.includes('ceo') || c.includes('diretor')) {
      return INSTRUCOES_TOM.EXECUTIVO;
    }
    if (c.includes('eng') || c.includes('cto')) {
      return INSTRUCOES_TOM.TECNICO;
    }
    return INSTRUCOES_TOM.OPERACIONAL;
  }

  /**
   * Constrói lista de regras a partir de ConfigIARegras.
   */
  private static buildRegrasFromConfig(config: ConfigIA): string {
    const linhas: string[] = [];

    config.regras.regras.forEach((regra, i) => {
      linhas.push(`${i + 1}. ${regra}`);
    });

    if (config.regras.palavras_chave_bloqueadas.length > 0) {
      linhas.push(
        `${linhas.length + 1}. Nunca use as palavras: ${config.regras.palavras_chave_bloqueadas.join(', ')}.`
      );
    }

    if (config.regras.palavras_chave_obrigatorias.length > 0) {
      linhas.push(
        `${linhas.length + 1}. Sempre mencione: ${config.regras.palavras_chave_obrigatorias.join(', ')}.`
      );
    }

    return linhas.length > 0
      ? linhas.join('\n')
      : this.buildRegrasDefault();
  }

  /**
   * Regras padrão quando config dinâmica não está disponível.
   */
  private static buildRegrasDefault(_input?: GeracaoInput): string {
    return `1. Não invente dados. Use apenas a Base de Conhecimento.
2. Seja empático mas focado no fechamento.
3. Responda em no máximo 2 a 3 frases curtas, sem listas e sem quebras de
   parágrafo, totalizando entre 150 e 500 caracteres.
4. Seja direto: nada de introduções longas ou repetições.`;
  }
}
