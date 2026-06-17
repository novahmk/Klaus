// src/components/5-geracao-resposta/prompts.ts
import { INSTRUCOES_TOM } from './constants';
import { GeracaoInput } from './types';

export class PromptBuilder {
  static build(input: GeracaoInput): string {
    const tom = this.getTomByCargo(input.contextoLead.cargo);

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
1. Não invente dados. Use apenas a Base de Conhecimento.
2. Seja empático mas focado no fechamento.
3. Responda entre 150 e 500 caracteres.
`;
  }

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
}
