/**
 * Sprint 1: Tipos de Configuração
 */

export interface ConfigPersona {
  nome: string;
  descricao?: string;
  cargo_alvo?: string;
}

export interface ConfigObjetivo {
  descricao: string;
  objetivo_curto?: string;
  objetivo_longo?: string;
}

export interface ConfigAbordagens {
  abordagens: string[];
  evitar: string[];
}

export interface ConfigContexto {
  contexto_empresa?: string;
  contexto_industria?: string;
  contexto_mercado?: string;
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
