// src/components/4-ranking-objecoes/queries.ts

export const QUERIES = {
  BUSCAR_PERGUNTAS_CLIENTE: `
    SELECT id, texto, 'personalizada' as tipo, nicho, tema
    FROM perguntas_personalizadas
    WHERE cliente_id = $1 AND nicho = $2
  `,

  BUSCAR_EFETIVIDADE: `
    SELECT
      COUNT(CASE WHEN resultado = 'sucesso' THEN 1 END)::float / NULLIF(COUNT(*), 0)::float as taxa
    FROM historico_efetividade
    WHERE pergunta_id = $1
  `
};

export const INDICES_RECOMENDADOS = `
  CREATE INDEX IF NOT EXISTS idx_perguntas_genericas_nicho
    ON perguntas_genericas(nicho);

  CREATE INDEX IF NOT EXISTS idx_perguntas_personalizadas_cliente
    ON perguntas_personalizadas(cliente_id);

  CREATE INDEX IF NOT EXISTS idx_historico_efetividade_pergunta
    ON historico_efetividade(pergunta_id);
`;
