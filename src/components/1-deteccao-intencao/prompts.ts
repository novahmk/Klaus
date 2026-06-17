/**
 * Prompts para análise de intenção com GPT
 * Klaus V2 - Componente 1
 */

import { Intencao } from './types';

/**
 * Gera o prompt do sistema para análise de intenção
 */
export function gerarPromptSistema(): string {
  return `Você é um especialista em vendas e análise de intenção de leads.

Sua tarefa é analisar mensagens de leads e detectar sua intenção.

As intenções possíveis são:
- QUER_AGENDAR: Lead quer agendar uma reunião ou demonstração
- QUER_MAIS_INFO: Lead quer conhecer mais detalhes sobre o produto/serviço
- TEM_OBJECAO: Lead apresenta uma objeção ou questionamento
- DEMONSTRA_INTERESSE: Lead demonstra interesse genuíno
- NAO_INTERESSADO: Lead claramente não tem interesse
- NAO_RESPONDEU: Lead não respondeu ou resposta muito vaga

IMPORTANTE:
1. Responda SEMPRE em formato JSON
2. Sempre retorne os campos: intencao, confianca, motivo
3. Confiança deve ser número entre 0 e 100
4. Considere o histórico e contexto da conversa
5. Seja rigoroso - apenas retorne alta confiança se tiver certeza

Exemplo de resposta esperada:
{
  "intencao": "QUER_AGENDAR",
  "confianca": 95,
  "motivo": "Lead explicitamente pediu para agendar reunião"
}`;
}

/**
 * Gera o prompt do usuário para análise de intenção
 */
export function gerarPromptUsuario(
  mensagem: string,
  historico?: Array<{ papel: string; conteudo: string }>,
  contexto?: Record<string, unknown>
): string {
  let prompt = `Analise a seguinte mensagem do lead:\n\n"${mensagem}"\n\n`;

  if (historico && historico.length > 0) {
    prompt += `Histórico da conversa:\n`;
    historico.forEach(msg => {
      prompt += `${msg.papel}: ${msg.conteudo}\n`;
    });
    prompt += `\n`;
  }

  if (contexto) {
    if (contexto.empresa) {
      prompt += `Empresa: ${contexto.empresa}\n`;
    }
    if (contexto.segmento) {
      prompt += `Segmento: ${contexto.segmento}\n`;
    }
    if (contexto.faseFunil) {
      prompt += `Fase do funil: ${contexto.faseFunil}\n`;
    }
  }

  prompt += `\nRetorne a análise em JSON com os campos: intencao, confianca (0-100), motivo`;

  return prompt;
}

/**
 * Mapeia string de intenção para enum
 */
export function mapearIntencaoString(valor: string): Intencao | null {
  const valor_normalizado = valor.toUpperCase().trim();
  
  if (Object.values(Intencao).includes(valor_normalizado as Intencao)) {
    return valor_normalizado as Intencao;
  }
  
  return null;
}

/**
 * Descreve uma intenção em português
 */
export function descreverIntencao(intencao: Intencao): string {
  const descricoes: Record<Intencao, string> = {
    [Intencao.QUER_AGENDAR]: 'Lead quer agendar uma reunião',
    [Intencao.QUER_MAIS_INFO]: 'Lead quer conhecer mais informações',
    [Intencao.TEM_OBJECAO]: 'Lead apresenta uma objeção',
    [Intencao.DEMONSTRA_INTERESSE]: 'Lead demonstra interesse',
    [Intencao.NAO_INTERESSADO]: 'Lead não tem interesse',
    [Intencao.NAO_RESPONDEU]: 'Lead não respondeu adequadamente'
  };

  return descricoes[intencao];
}
