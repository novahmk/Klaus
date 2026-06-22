/**
 * Tipos para configurações de IA carregadas do Supabase.
 * Cada interface mapeia uma tabela cfg_ia_* do banco.
 */

export interface ConfigIAParametros {
  max_tokens: number;
  temperature: number;
  model: string;
}

export interface ConfigIAValidacao {
  min_length: number;
  max_length: number;
  min_score: number;
  max_retries: number;
}

export interface ConfigIATomVoz {
  tom_geral?: string;
  tom_executivo?: string;
  tom_tecnico?: string;
  tom_suporte?: string;
}

export interface ConfigIARegras {
  regras: string[];
  palavras_chave_bloqueadas: string[];
  palavras_chave_obrigatorias: string[];
}

export interface ConfigIADisparos {
  intervalo_min_segundos: number;
  intervalo_max_segundos: number;
  limite_diario: number;
}

export interface ConfigIAAprendizado {
  ativo: boolean;
  metricas_habilitadas: boolean;
}

/**
 * Agregação de todas as configurações de IA para um cliente.
 */
export interface ConfigIA {
  cliente_id: string;
  parametros: ConfigIAParametros;
  validacao: ConfigIAValidacao;
  tom_voz: ConfigIATomVoz;
  regras: ConfigIARegras;
  disparos: ConfigIADisparos;
  aprendizado: ConfigIAAprendizado;
  ultima_atualizacao: string;
}
