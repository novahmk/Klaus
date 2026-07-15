/**
 * Sprint 1: Tipos de Configuração
 */

export interface ConfigPersona {
  nome: string;
  descricao?: string;
}

export interface ConfigObjetivo {
  objetivo_curto?: string;
  objetivo_longo?: string;
}

/**
 * Ajustado para bater com o schema real da tabela `cfg_ia_abordagens`
 * (3 textos livres por etapa, em vez de arrays de tags).
 */
export interface ConfigAbordagens {
  abordagem_inicial?: string;
  abordagem_objecao?: string;
  abordagem_fechamento?: string;
}

/**
 * Ajustado para bater com o schema real da tabela `cfg_ia_contexto`.
 * `cargo_alvo` migrou de `ConfigPersona` para cá; `palavras_chave_bloqueadas`
 * é combinada (deduplicada) com a lista equivalente em `ConfigRegras` na
 * hora de montar o prompt.
 */
export interface ConfigContexto {
  cargo_alvo?: string;
  palavras_chave_bloqueadas?: string[];
  base_conhecimento?: string | Record<string, unknown>;
}

export interface ConfigTomVoz {
  tom_geral?: string;
  tom_executivo?: string;
  tom_tecnico?: string;
  tom_suporte?: string;
}

export interface ConfigRegras {
  regras: string[];
  palavras_chave_bloqueadas: string[];
  palavras_chave_obrigatorias: string[];
}

export interface DashboardConfig {
  cliente_id: string;
  persona: ConfigPersona;
  objetivo: ConfigObjetivo;
  abordagens: ConfigAbordagens;
  contexto: ConfigContexto;
  tom_voz: ConfigTomVoz;
  regras: ConfigRegras;
  ultima_atualizacao: string;
}

/**
 * Sprint 7: Pesos de scoring de qualificação (devem somar 1.0).
 */
export interface ConfigScoringPesos {
  intencao: number;
  engajamento: number;
  contexto: number;
  historico: number;
}

/**
 * Sprint 7: Configuração dinâmica de scoring/qualificação por cliente.
 * Carregada da tabela `cfg_scoring` no Supabase.
 */
export interface ConfigScoring {
  cliente_id: string;
  pesos: ConfigScoringPesos;
  scores_intencao: Record<string, number>;
  threshold_handoff: number;
  threshold_notificacao: number;
  atualizado_em: string;
}
