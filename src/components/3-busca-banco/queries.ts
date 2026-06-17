// src/components/3-busca-banco/queries.ts

export const QUERIES = {
  BUSCA_BASE_CONHECIMENTO: `
    SELECT
      id,
      cliente_id,
      tema,
      descricao,
      beneficios,
      preco,
      diferenciais,
      casos_de_uso,
      embedding,
      criado_em,
      atualizado_em,
      (
        CASE
          WHEN tema ILIKE $1 THEN 1.0
          WHEN descricao ILIKE $1 THEN 0.8
          WHEN array_to_string(beneficios, ' ') ILIKE $1 THEN 0.6
          ELSE 0.3
        END
      ) as relevancia
    FROM base_conhecimento
    WHERE cliente_id = $2
      AND (
        tema ILIKE $1
        OR descricao ILIKE $1
        OR array_to_string(beneficios, ' ') ILIKE $1
        OR array_to_string(diferenciais, ' ') ILIKE $1
      )
    ORDER BY relevancia DESC, atualizado_em DESC
    LIMIT $3
  `,

  BUSCA_OBJECOES_PADRAO: `
    SELECT
      id,
      objecao,
      palavras_chave,
      resposta,
      taxa_efetividade,
      embedding,
      criado_em,
      atualizado_em,
      (
        CASE
          WHEN objecao ILIKE $1 THEN 1.0
          WHEN array_to_string(palavras_chave, ' ') ILIKE $1 THEN 0.8
          ELSE 0.5
        END
      ) as relevancia
    FROM objecoes_padrao
    WHERE
      objecao ILIKE $1
      OR array_to_string(palavras_chave, ' ') ILIKE $1
    ORDER BY relevancia DESC, taxa_efetividade DESC
    LIMIT $2
  `,

  BUSCA_OBJECOES_PERSONALIZADAS: `
    SELECT
      id,
      cliente_id,
      objecao,
      palavras_chave,
      resposta,
      taxa_efetividade,
      embedding,
      criado_em,
      atualizado_em,
      (
        CASE
          WHEN objecao ILIKE $1 THEN 1.0
          WHEN array_to_string(palavras_chave, ' ') ILIKE $1 THEN 0.8
          ELSE 0.5
        END
      ) as relevancia
    FROM objecoes_personalizadas
    WHERE cliente_id = $2
      AND (
        objecao ILIKE $1
        OR array_to_string(palavras_chave, ' ') ILIKE $1
      )
    ORDER BY relevancia DESC, taxa_efetividade DESC
    LIMIT $3
  `,

  BUSCA_SEMANTICA_BASE: `
    SELECT
      id,
      cliente_id,
      tema,
      descricao,
      beneficios,
      preco,
      diferenciais,
      casos_de_uso,
      embedding,
      criado_em,
      atualizado_em,
      (1 - (embedding <=> $1::vector)) as relevancia
    FROM base_conhecimento
    WHERE cliente_id = $2
      AND embedding IS NOT NULL
      AND (1 - (embedding <=> $1::vector)) > $3
    ORDER BY relevancia DESC
    LIMIT $4
  `,

  BUSCA_SEMANTICA_OBJECOES: `
    SELECT
      id,
      cliente_id,
      objecao,
      palavras_chave,
      resposta,
      taxa_efetividade,
      embedding,
      criado_em,
      atualizado_em,
      (1 - (embedding <=> $1::vector)) as relevancia
    FROM objecoes_personalizadas
    WHERE cliente_id = $2
      AND embedding IS NOT NULL
      AND (1 - (embedding <=> $1::vector)) > $3
    ORDER BY relevancia DESC, taxa_efetividade DESC
    LIMIT $4
  `,

  ATUALIZA_EFETIVIDADE: `
    UPDATE objecoes_personalizadas
    SET
      taxa_efetividade = LEAST(taxa_efetividade + 0.1, 1.0),
      atualizado_em = NOW()
    WHERE id = $1 AND cliente_id = $2
    RETURNING taxa_efetividade
  `,

  REGISTRA_USO_RESPOSTA: `
    INSERT INTO uso_respostas (
      cliente_id,
      lead_id,
      resposta_id,
      tipo_resposta,
      resultado,
      criado_em
    ) VALUES ($1, $2, $3, $4, $5, NOW())
    ON CONFLICT DO NOTHING
  `
};

export const INDICES_RECOMENDADOS = `
  CREATE INDEX IF NOT EXISTS idx_base_conhecimento_cliente_tema
    ON base_conhecimento(cliente_id, tema);

  CREATE INDEX IF NOT EXISTS idx_objecoes_padrao_objecao
    ON objecoes_padrao(objecao);

  CREATE INDEX IF NOT EXISTS idx_objecoes_personalizadas_cliente
    ON objecoes_personalizadas(cliente_id, objecao);

  CREATE INDEX IF NOT EXISTS idx_base_conhecimento_embedding
    ON base_conhecimento USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

  CREATE INDEX IF NOT EXISTS idx_objecoes_embedding
    ON objecoes_personalizadas USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

  CREATE INDEX IF NOT EXISTS idx_uso_respostas_cliente_lead
    ON uso_respostas(cliente_id, lead_id);
`;
