-- 003_geracao_resposta.sql — Componente 5: Geração de Resposta (Fallback IA)
CREATE TABLE IF NOT EXISTS respostas_geradas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL,
  lead_id UUID NOT NULL,
  objecao TEXT NOT NULL,
  resposta_gerada TEXT NOT NULL,
  tipo_objecao VARCHAR(20),
  cargo_lead VARCHAR(100),
  confianca DECIMAL(3,2),
  resultado BOOLEAN,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS historico_geracao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_objecao VARCHAR(20),
  numero_geracoes INT DEFAULT 0,
  taxa_sucesso DECIMAL(5,4),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_respostas_geradas_cliente_lead
  ON respostas_geradas(cliente_id, lead_id);
CREATE INDEX IF NOT EXISTS idx_historico_geracao_tipo
  ON historico_geracao(tipo_objecao);
