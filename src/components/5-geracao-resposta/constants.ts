// src/components/5-geracao-resposta/constants.ts
//
// CRITERIOS_VALIDACAO e GERACAO_CONFIG foram removidos daqui.
// Os valores agora são carregados dinamicamente do Supabase via
// src/modules/ia-config-loader. Os defaults estão em
// src/modules/ia-config-loader/defaults.ts.

/**
 * Tom de voz fallback — usado quando cfg_ia_tom_voz não está disponível.
 * Sobrescrito pela ConfigIATomVoz carregada do Supabase.
 */
export const INSTRUCOES_TOM = {
  EXECUTIVO:
    'Foco em ROI, visão estratégica e resultados de alto nível. Linguagem direta.',
  TECNICO:
    'Foco em especificações, integração e performance. Linguagem precisa.',
  OPERACIONAL:
    'Foco em facilidade de uso, implementação e dia a dia. Linguagem prática.'
};
