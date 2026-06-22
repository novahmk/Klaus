export interface ConfigIAParametros {
  id?: string;
  cliente_id: string;
  temperatura: number;
  max_tokens: number;
  modelo_chat: string;
  modelo_embedding: string;
  tamanho_min_resposta: number;
  tamanho_max_resposta: number;
  score_minimo_validacao: number;
  max_tentativas_geracao: number;
  cache_ttl_resposta_segundos: number;
  cache_ttl_config_ms: number;
  usar_cache: boolean;
  usar_emoji: boolean;
  usar_cta_obrigatorio: boolean;
  criado_em?: string;
  atualizado_em?: string;
}

export interface ConfigIAValidacao {
  id?: string;
  cliente_id: string;
  penalidade_tamanho_minimo: number;
  penalidade_tamanho_maximo: number;
  penalidade_sem_cta: number;
  penalidade_tom_negativo: number;
  palavras_bloqueadas: string[];
  palavras_obrigatorias: string[];
  criado_em?: string;
  atualizado_em?: string;
}

export interface ConfigIATomVoz {
  id?: string;
  cliente_id: string;
  cargo_pattern: string;
  tom_descricao: string;
  exemplo_resposta_1?: string;
  exemplo_resposta_2?: string;
  ativo: boolean;
  criado_em?: string;
  atualizado_em?: string;
}

export interface ConfigIARegras {
  id?: string;
  cliente_id: string;
  numero_maximo_frases: number;
  permitir_listas: boolean;
  permitir_quebras_paragrafo: boolean;
  permitir_introducoes_longas: boolean;
  instrucao_customizada?: string;
  tipo_objecao?: string;
  regra_especifica?: string;
  ativo: boolean;
  criado_em?: string;
  atualizado_em?: string;
}

export interface ConfigIACompleta {
  parametros: ConfigIAParametros;
  validacao: ConfigIAValidacao;
  tom_voz: ConfigIATomVoz[];
  regras: ConfigIARegras[];
  ultima_atualizacao: string;
  versao: number;
}
