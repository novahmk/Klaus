// src/components/5-geracao-resposta/prompts.ts
import { INSTRUCOES_TOM } from './constants';
import { GeracaoInput } from './types';
import { ConfigIACompleta } from '../../modules/config-loader/ia-config-types';

export class PromptBuilder {
  static build(input: GeracaoInput, config?: ConfigIACompleta): string {
    const tom = this.getTomByCargo(input.contextoLead.cargo, config);
    const regras = this.buildRegras(input, config);
    const minLen = config?.parametros.tamanho_min_resposta ?? 150;
    const maxLen = config?.parametros.tamanho_max_resposta ?? 500;

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
4. Seja direto: nada de introduções longas ou repetições.
5. Resposta entre ${minLen} e ${maxLen} caracteres.
`;
  }

  private static getTomByCargo(cargo: string, config?: ConfigIACompleta): string {
    const c = cargo.toLowerCase();

    // Use dynamic tone config from Supabase when available
    if (config?.tom_voz && config.tom_voz.length > 0) {
      for (const tom of config.tom_voz) {
        const pattern = new RegExp(tom.cargo_pattern, 'i');
        if (pattern.test(c)) {
          return tom.tom_descricao;
        }
      }
      // Return last entry as default if no pattern matched
      return config.tom_voz[config.tom_voz.length - 1].tom_descricao;
    }

    // Fallback to static constants
    if (c.includes('ceo') || c.includes('diretor')) {
      return INSTRUCOES_TOM.EXECUTIVO;
    }
    if (c.includes('eng') || c.includes('cto')) {
      return INSTRUCOES_TOM.TECNICO;
    }
    return INSTRUCOES_TOM.OPERACIONAL;
  }

  private static buildRegras(input: GeracaoInput, config?: ConfigIACompleta): string {
    // Use dynamic rules from Supabase when available
    if (config?.regras && config.regras.length > 0) {
      const regra = config.regras.find(
        r => !r.tipo_objecao || r.tipo_objecao === input.tipoObjecao
      ) ?? config.regras[0];

      const linhas: string[] = [];
      linhas.push('1. Não invente dados. Use apenas a Base de Conhecimento.');
      linhas.push('2. Seja empático mas focado no fechamento.');

      const maxFrases = regra.numero_maximo_frases ?? 3;
      const semListas = !regra.permitir_listas ? ', sem listas' : '';
      const semQuebras = !regra.permitir_quebras_paragrafo ? ' e sem quebras de parágrafo' : '';
      linhas.push(`3. Responda em no máximo ${maxFrases} frases curtas${semListas}${semQuebras}.`);

      if (regra.instrucao_customizada) {
        linhas.push(`   ${regra.instrucao_customizada}`);
      }

      return linhas.join('\n');
    }

    // Fallback to static rules
    return [
      '1. Não invente dados. Use apenas a Base de Conhecimento.',
      '2. Seja empático mas focado no fechamento.',
      '3. Responda em no máximo 2 a 3 frases curtas, sem listas e sem quebras de\n   parágrafo.'
    ].join('\n');
  }
}
