import {
  ConfigIAParametros,
  ConfigIAValidacao,
  ConfigIATomVoz,
  ConfigIARegras,
  ConfigIACompleta
} from './ia-config-types';

export const DEFAULT_PARAMETROS: ConfigIAParametros = {
  cliente_id: 'default',
  temperatura: 0.4,
  max_tokens: 200,
  modelo_chat: 'gpt-4',
  modelo_embedding: 'text-embedding-3-small',
  tamanho_min_resposta: 150,
  tamanho_max_resposta: 500,
  score_minimo_validacao: 70,
  max_tentativas_geracao: 3,
  cache_ttl_resposta_segundos: 3600,
  cache_ttl_config_ms: 300000,
  usar_cache: true,
  usar_emoji: false,
  usar_cta_obrigatorio: true
};

export const DEFAULT_VALIDACAO: ConfigIAValidacao = {
  cliente_id: 'default',
  penalidade_tamanho_minimo: -30,
  penalidade_tamanho_maximo: -30,
  penalidade_sem_cta: -10,
  penalidade_tom_negativo: -20,
  palavras_bloqueadas: ['infelizmente', 'desculpe', 'problema', 'erro'],
  palavras_obrigatorias: []
};

export const DEFAULT_TOM_VOZ: ConfigIATomVoz[] = [
  {
    cliente_id: 'default',
    cargo_pattern: 'ceo|diretor|presidente|c-level',
    tom_descricao: 'Foco em ROI, visão estratégica e resultados de alto nível. Linguagem direta e executiva.',
    ativo: true
  },
  {
    cliente_id: 'default',
    cargo_pattern: 'eng|cto|tech|developer|arquiteto',
    tom_descricao: 'Foco em especificações, integração e performance. Linguagem precisa e técnica.',
    ativo: true
  },
  {
    cliente_id: 'default',
    cargo_pattern: 'operacional|gerente|supervisor|coordenador',
    tom_descricao: 'Foco em facilidade de uso, implementação e dia a dia. Linguagem prática.',
    ativo: true
  }
];

export const DEFAULT_REGRAS: ConfigIARegras[] = [
  {
    cliente_id: 'default',
    numero_maximo_frases: 3,
    permitir_listas: false,
    permitir_quebras_paragrafo: false,
    permitir_introducoes_longas: false,
    instrucao_customizada: 'Seja direto, empático e focado no fechamento. Não invente dados.',
    ativo: true
  }
];

export function getDefaultConfigIA(clienteId: string): ConfigIACompleta {
  return {
    parametros: { ...DEFAULT_PARAMETROS, cliente_id: clienteId },
    validacao: { ...DEFAULT_VALIDACAO, cliente_id: clienteId },
    tom_voz: DEFAULT_TOM_VOZ.map(tom => ({ ...tom, cliente_id: clienteId })),
    regras: DEFAULT_REGRAS.map(regra => ({ ...regra, cliente_id: clienteId })),
    ultima_atualizacao: new Date().toISOString(),
    versao: 1
  };
}

export function validarConfigParametros(config: ConfigIAParametros): string[] {
  const erros: string[] = [];
  if (config.temperatura < 0 || config.temperatura > 2) {
    erros.push('Temperatura deve estar entre 0 e 2');
  }
  if (config.max_tokens < 50 || config.max_tokens > 1000) {
    erros.push('Max tokens deve estar entre 50 e 1000');
  }
  if (config.tamanho_min_resposta >= config.tamanho_max_resposta) {
    erros.push('Tamanho mínimo deve ser menor que tamanho máximo');
  }
  return erros;
}

export function validarConfigCompleta(config: ConfigIACompleta): string[] {
  const erros: string[] = [];
  erros.push(...validarConfigParametros(config.parametros));
  if (!config.regras || config.regras.length === 0) {
    erros.push('Deve existir pelo menos uma regra');
  }
  if (!config.tom_voz || config.tom_voz.length === 0) {
    erros.push('Deve existir pelo menos um tom de voz');
  }
  return erros;
}
