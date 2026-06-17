/**
 * Constantes e Templates - Componente 2: Gerador de Perguntas
 * Klaus V2 - Componente 2
 */

import { TemplatoPergunta, CamadaPergunta } from './types';
import { Intencao } from '../1-deteccao-intencao';

/**
 * Templates de perguntas por camada
 * Camada 1: Necessidade - Descobrir o que o lead precisa
 * Camada 2: Objeção - Entender as objeções
 * Camada 3: Confirmação - Confirmar entendimento e próximos passos
 */
export const TEMPLATES_PERGUNTAS: TemplatoPergunta[] = [
  // ==================== CAMADA 1: NECESSIDADE ====================
  {
    pergunta: 'Qual é o maior desafio que sua empresa enfrenta atualmente?',
    contextoEsperado: 'Lead descrevendo pain point principal',
    camada: CamadaPergunta.NECESSIDADE
  },
  {
    pergunta: 'Como você está lidando com isso hoje?',
    contextoEsperado: 'Lead explicando solução atual',
    camada: CamadaPergunta.NECESSIDADE
  },
  {
    pergunta: 'Qual seria o impacto se conseguisse resolver esse desafio?',
    contextoEsperado: 'Lead descrevendo benefício potencial',
    camada: CamadaPergunta.NECESSIDADE
  },
  {
    pergunta: 'Quem mais na sua equipe é impactado por esse problema?',
    contextoEsperado: 'Lead identificando stakeholders',
    camada: CamadaPergunta.NECESSIDADE
  },
  {
    pergunta: 'Isso é uma prioridade para vocês neste trimestre?',
    contextoEsperado: 'Lead compartilhando prioridade',
    camada: CamadaPergunta.NECESSIDADE
  },
  {
    pergunta: 'Quanto tempo você dedica por semana para essa atividade?',
    contextoEsperado: 'Lead quantificando tempo gasto',
    camada: CamadaPergunta.NECESSIDADE
  },
  {
    pergunta: 'Qual seria a métrica de sucesso para você?',
    contextoEsperado: 'Lead definindo sucesso',
    camada: CamadaPergunta.NECESSIDADE
  },
  {
    pergunta: 'Você já buscou soluções para isso antes?',
    contextoEsperado: 'Lead compartilhando experiência',
    camada: CamadaPergunta.NECESSIDADE
  },

  // ==================== CAMADA 2: OBJEÇÃO ====================
  {
    pergunta: 'O que seria necessário para mudar sua solução atual?',
    contextoEsperado: 'Lead descrevendo critérios',
    camada: CamadaPergunta.OBJECAO
  },
  {
    pergunta: 'Quais são suas preocupações principais com uma nova solução?',
    contextoEsperado: 'Lead compartilhando medos',
    camada: CamadaPergunta.OBJECAO
  },
  {
    pergunta: 'Como vocês avaliam novas ferramentas?',
    contextoEsperado: 'Lead explicando processo de avaliação',
    camada: CamadaPergunta.OBJECAO
  },
  {
    pergunta: 'Qual é o seu orçamento disponível para isso?',
    contextoEsperado: 'Lead compartilhando orçamento',
    camada: CamadaPergunta.OBJECAO
  },
  {
    pergunta: 'Qual seria seu maior medo ao implementar algo novo?',
    contextoEsperado: 'Lead identificando risco principal',
    camada: CamadaPergunta.OBJECAO
  },
  {
    pergunta: 'Quanto tempo você poderia dedicar para uma implementação?',
    contextoEsperado: 'Lead definindo timeline',
    camada: CamadaPergunta.OBJECAO
  },
  {
    pergunta: 'Existem pessoas que se opõem a mudar?',
    contextoEsperado: 'Lead identificando resistência',
    camada: CamadaPergunta.OBJECAO
  },
  {
    pergunta: 'O que você precisa para apresentar isso ao seu chefe?',
    contextoEsperado: 'Lead descrevendo necessidade de justificativa',
    camada: CamadaPergunta.OBJECAO
  },

  // ==================== CAMADA 3: CONFIRMAÇÃO ====================
  {
    pergunta: 'Se eu entendi bem, o problema principal é...?',
    contextoEsperado: 'Lead confirmando entendimento',
    camada: CamadaPergunta.CONFIRMACAO
  },
  {
    pergunta: 'E o objetivo seria...?',
    contextoEsperado: 'Lead confirmando objetivo',
    camada: CamadaPergunta.CONFIRMACAO
  },
  {
    pergunta: 'Faz sentido marcarmos uma reunião para aprofundar?',
    contextoEsperado: 'Lead concordando com próximo passo',
    camada: CamadaPergunta.CONFIRMACAO
  },
  {
    pergunta: 'Quando você teria disponibilidade para conversar?',
    contextoEsperado: 'Lead sugerindo horário',
    camada: CamadaPergunta.CONFIRMACAO
  },
  {
    pergunta: 'Quer que eu prepare uma proposta personalizada?',
    contextoEsperado: 'Lead respondendo positivamente',
    camada: CamadaPergunta.CONFIRMACAO
  },
  {
    pergunta: 'Posso conectá-lo com nosso especialista?',
    contextoEsperado: 'Lead concordando com conexão',
    camada: CamadaPergunta.CONFIRMACAO
  },
  {
    pergunta: 'Qual seria o próximo passo ideal para você?',
    contextoEsperado: 'Lead definindo próximo passo',
    camada: CamadaPergunta.CONFIRMACAO
  },
  {
    pergunta: 'Posso enviar um case de sucesso similar?',
    contextoEsperado: 'Lead recebendo comprovante social',
    camada: CamadaPergunta.CONFIRMACAO
  }
];

/**
 * Intervalo válido de caracteres
 */
export const CARACTERES = {
  MINIMO: 20,
  MAXIMO: 150
};

/**
 * Limite de similaridade máxima permitida
 */
export const SIMILARIDADE_MAXIMA = 0.70; // 70%

/**
 * Palavras que indicam pergunta aberta
 */
export const PALAVRAS_FECHADAS = [
  'você tem',
  'você usa',
  'você prefere',
  'é verdade que',
  'concorda que',
  'não é'
];

/**
 * Palavras-chave para cada intenção
 */
export const PALAVRAS_CHAVE_INTENCAO: Record<string, string[]> = {
  [Intencao.QUER_AGENDAR]: ['reunião', 'agenda', 'horário', 'data', 'conversa', 'chamada'],
  [Intencao.QUER_MAIS_INFO]: ['informação', 'detalhe', 'como', 'funciona', 'explicar', 'processo'],
  [Intencao.TEM_OBJECAO]: ['mas', 'preço', 'custo', 'implementação', 'complexo', 'difícil'],
  [Intencao.DEMONSTRA_INTERESSE]: ['interessante', 'legal', 'bacana', 'perfeito', 'excelente'],
  [Intencao.NAO_INTERESSADO]: ['não', 'não interessa', 'chega', 'pare'],
  [Intencao.NAO_RESPONDEU]: []
};

/**
 * TTL do cache em segundos
 */
export const CACHE_DEFAULT_TTL = 7200; // 2 horas

/**
 * Modelo GPT a usar
 */
export const GPT_MODEL = 'gpt-4-turbo-preview';

/**
 * Temperatura para respostas do GPT
 */
export const GPT_TEMPERATURE = 0.4;

/**
 * Máximo de tokens para resposta
 */
export const GPT_MAX_TOKENS = 200;

/**
 * Algoritmo de determinação de camada
 * Simples: baseado no número de perguntas já feitas
 */
export function determinarCamada(numeroPerguntasFeitas: number): 1 | 2 | 3 {
  if (numeroPerguntasFeitas === 0) return 1;
  if (numeroPerguntasFeitas === 1) return 2;
  return 3;
}
