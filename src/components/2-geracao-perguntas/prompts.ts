/**
 * Prompts para GPT - Componente 2: Gerador de Perguntas
 * Klaus V2 - Componente 2
 */

import { CamadaPergunta, GeradorPerguntasInput } from './types';
import { Intencao } from '../1-deteccao-intencao';

/**
 * Descreve a camada de forma textual
 */
function descreverCamada(camada: 1 | 2 | 3): string {
  const descricoes: Record<1 | 2 | 3, string> = {
    1: 'Necessidade - Descobrir o que o lead precisa',
    2: 'Objeção - Entender as objeções e preocupações',
    3: 'Confirmação - Confirmar entendimento e próximos passos'
  };
  return descricoes[camada];
}

/**
 * Descreve uma intenção
 */
function descreverIntencao(intencao: Intencao): string {
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

/**
 * Gera o prompt do sistema para geração de perguntas
 */
export function gerarPromptSistema(): string {
  return `Você é um especialista em vendas e qualificação de leads.

Sua tarefa é gerar perguntas adaptativas que levam o lead através de um funil de vendas em 3 camadas:

CAMADA 1 - NECESSIDADE:
- Descobrir qual é o real problema do lead
- Entender o impacto do problema
- Qualificar se o lead realmente tem a necessidade
- Fazer perguntas abertas sobre pain points

CAMADA 2 - OBJEÇÃO:
- Entender os medos e objeções do lead
- Descobrir critérios de compra
- Identificar resistência interna
- Qualificar disposição a agir

CAMADA 3 - CONFIRMAÇÃO:
- Confirmar entendimento dos problemas
- Reafirmar valor potencial
- Sugerir próximos passos
- Garantir alinhamento

REGRAS PARA GERAÇÃO DE PERGUNTAS:
1. Pergunta deve ter entre 20 e 150 caracteres
2. Deve ser uma pergunta aberta (começar com O quê, Como, Qual, Quando, Por quê, Quem)
3. Sempre terminar com "?"
4. Sem placeholders ou variáveis
5. Sem repetir perguntas já feitas
6. Ser natural e conversacional
7. Evitar jargão técnico excessivo

FORMATO DE RESPOSTA:
Retorne SEMPRE um JSON com estes campos:
{
  "pergunta": "sua pergunta aqui?",
  "contextoEsperado": "o que espera ouvir do lead",
  "justificativa": "por que fazer essa pergunta agora"
}`;
}

/**
 * Gera o prompt do usuário para geração de pergunta
 */
export function gerarPromptUsuario(
  input: GeradorPerguntasInput,
  camada: 1 | 2 | 3
): string {
  let prompt = `Gere uma pergunta para a CAMADA ${camada} - ${descreverCamada(camada)}

CONTEXTO:
- Tema: ${input.tema}
- Intenção detectada: ${descreverIntencao(input.intencao)}
- Cliente ID: ${input.clienteId}
- Número de perguntas já feitas: ${input.perguntasJaFeitas?.length || 0}

HISTÓRICO RECENTE:`;

  // Adicionar últimas 3 mensagens do histórico
  const ultimasMensagens = input.historico.slice(-3);
  for (const msg of ultimasMensagens) {
    prompt += `\n${msg.papel === 'lead' ? 'Lead' : 'Você'}: ${msg.conteudo}`;
  }

  if (input.perguntasJaFeitas && input.perguntasJaFeitas.length > 0) {
    prompt += `\n\nPERGUNTAS JÁ FEITAS (NÃO REPITA):`;
    input.perguntasJaFeitas.forEach((p, i) => {
      prompt += `\n${i + 1}. ${p}`;
    });
  }

  prompt += `\n\nGere uma pergunta coerente com o histórico, apropriada para a camada ${camada}.`;
  prompt += `\nRetorne APENAS o JSON, sem explicação adicional.`;

  return prompt;
}

/**
 * Gera template alternativo baseado em contexto
 */
export function gerarTemplateAlternativo(
  input: GeradorPerguntasInput,
  camada: 1 | 2 | 3
): string {
  const templates: Record<Intencao, Record<1 | 2 | 3, string>> = {
    [Intencao.QUER_AGENDAR]: {
      1: 'O que você gostaria de alcançar em uma conversa conosco?',
      2: 'Qual é a sua principal preocupação com uma reunião?',
      3: 'Que dia e hora funcionam melhor para você?'
    },
    [Intencao.QUER_MAIS_INFO]: {
      1: 'Qual aspecto você gostaria de entender melhor?',
      2: 'O que você precisa saber antes de se interessar?',
      3: 'Tudo ficou claro para você?'
    },
    [Intencao.TEM_OBJECAO]: {
      1: 'Qual é a sua maior preocupação com nossa solução?',
      2: 'Como poderíamos tornar isso menos arriscado para você?',
      3: 'Isso resolveria sua preocupação principal?'
    },
    [Intencao.DEMONSTRA_INTERESSE]: {
      1: 'Por que essa solução chamou sua atenção?',
      2: 'O que seria necessário para você implementar?',
      3: 'Você quer conhecer mais sobre a implementação?'
    },
    [Intencao.NAO_INTERESSADO]: {
      1: 'O que você estava esperando que fosse diferente?',
      2: 'Pode me contar o que não funcionou no passado?',
      3: 'Vale a pena ao menos deixar a porta aberta?'
    },
    [Intencao.NAO_RESPONDEU]: {
      1: 'O que seria importante para você nessa conversa?',
      2: 'Qual é a situação atual da sua empresa?',
      3: 'Faz sentido conversarmos mais sobre isso?'
    }
  };

  return templates[input.intencao][camada] || '';
}
