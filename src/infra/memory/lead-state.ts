// src/infra/memory/lead-state.ts

export type EtapaFunil =
  | 'novo'
  | 'em_qualificacao'
  | 'qualificado'
  | 'hot'
  | 'follow_up';

export type Temperatura = 'cold' | 'warm' | 'hot';

export interface QualificacaoLead {
  interesse_principal: string | null;
  tempo_problema: string | null;
  tratamento_anterior: boolean | null;
  descricao_tratamento: string | null;
  urgencia: string | null;
  decide_sozinho: boolean | null;
  abertura_investimento: string | null;
  objecao_atual: string | null;
  sentimento: string | null;
  pronto_para_agendamento: boolean;
  nivel_qualificacao: string;
  sinais_extraidos_em: string | null;
}

export interface ContextoTurno {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface Lead {
  lead_id: string;
  nome: string;
  telefone: string;
  email: string | null;
  etapa_funil: EtapaFunil;
  score: number;
  lead_score: number;
  temperatura: Temperatura;
  nivel_qualificacao: string;
  interesses: string[];
  valor_potencial: number | null;
  ultima_interacao: string;
  total_mensagens_usuario: number;
  total_mensagens_assistente: number;
  follow_up_count: number;
  follow_up_proximo: string | null;
  proximo_follow_up: string | null;
  contexto_conversa: ContextoTurno[];
  qualificacao: QualificacaoLead;
  interesse_principal: string | null;
  tags: string[];
  ultimo_mensagem: string | null;
  [campo: string]: unknown;
}

/**
 * Define o estado inicial de um Lead.
 */
export const LeadState = {
  createNew(phone: string, name = 'Cliente'): Lead {
    return {
      lead_id: phone,
      nome: name,
      telefone: phone,
      email: null,
      etapa_funil: 'novo',
      score: 0,
      lead_score: 0,
      temperatura: 'cold',
      nivel_qualificacao: 'novo',
      interesses: [],
      valor_potencial: null,
      ultima_interacao: new Date().toISOString(),
      total_mensagens_usuario: 0,
      total_mensagens_assistente: 0,
      follow_up_count: 0,
      follow_up_proximo: null,
      proximo_follow_up: null,
      contexto_conversa: [],
      qualificacao: {
        interesse_principal: null,
        tempo_problema: null,
        tratamento_anterior: null,
        descricao_tratamento: null,
        urgencia: null,
        decide_sozinho: null,
        abertura_investimento: null,
        objecao_atual: null,
        sentimento: null,
        pronto_para_agendamento: false,
        nivel_qualificacao: 'novo',
        sinais_extraidos_em: null
      },
      interesse_principal: null,
      tags: [],
      ultimo_mensagem: null
    };
  }
};
