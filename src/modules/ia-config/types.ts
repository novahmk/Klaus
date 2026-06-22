/**
 * Tipos para as tabelas de configuração de IA
 * Klaus V2 - Módulo ia-config
 *
 * Mapeia as 6 tabelas Supabase:
 *   cfg_ia_parametros, cfg_ia_validacao, cfg_ia_tom_voz,
 *   cfg_ia_regras, cfg_ia_disparos, cfg_ia_aprendizado
 */

/** cfg_ia_parametros — parâmetros de geração da IA */
export interface CfgIaParametros {
  cliente_id: string;
  min_length: number;
  max_length: number;
  max_tokens: number;
  temperature: number;
  limite_frases: number;
  tom_resposta: string;
}

/** cfg_ia_validacao — regras de validação de resposta */
export interface CfgIaValidacao {
  cliente_id: string;
  regras_validacao: string[];
  min_confianca: number;
}

/** cfg_ia_tom_voz — tom de voz por perfil de interlocutor */
export interface CfgIaTomVoz {
  cliente_id: string;
  tom_geral: string;
  tom_executivo: string;
  tom_tecnico: string;
  tom_suporte: string;
}

/** cfg_ia_regras — regras de negócio e palavras-chave */
export interface CfgIaRegras {
  cliente_id: string;
  regras: string[];
  palavras_chave_bloqueadas: string[];
  palavras_chave_obrigatorias: string[];
}

/** cfg_ia_disparos — controle de cadência de envios */
export interface CfgIaDisparos {
  cliente_id: string;
  intervalo_min_segundos: number;
  intervalo_max_segundos: number;
  limite_diario: number;
}

/** cfg_ia_aprendizado — configurações de aprendizado contínuo */
export interface CfgIaAprendizado {
  cliente_id: string;
  ativar_aprendizado: boolean;
  taxa_aprendizado: number;
}

/**
 * Configuração completa de IA para um cliente.
 * Agrega todas as 6 tabelas em um único objeto.
 */
export interface ConfigIA {
  cliente_id: string;
  parametros: CfgIaParametros;
  validacao: CfgIaValidacao;
  tom_voz: CfgIaTomVoz;
  regras: CfgIaRegras;
  disparos: CfgIaDisparos;
  aprendizado: CfgIaAprendizado;
  /** ISO string do momento em que a config foi carregada */
  carregado_em: string;
  /** Indica se a config veio do Supabase (true) ou do fallback (false) */
  origem: 'supabase' | 'fallback';
}
