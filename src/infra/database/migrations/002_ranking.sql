-- 002_ranking.sql — Componente 4: Ranking de Objeções Adaptativo
CREATE TABLE IF NOT EXISTS perguntas_genericas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nicho VARCHAR(50) NOT NULL,
  tema VARCHAR(100),
  texto TEXT NOT NULL,
  tipo VARCHAR(20) CHECK (tipo IN ('aberta', 'fechada', 'escala')),
  dificuldade VARCHAR(20) DEFAULT 'media',
  embedding vector(1536),
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS perguntas_personalizadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL,
  nicho VARCHAR(50),
  tema VARCHAR(100),
  texto TEXT NOT NULL,
  tipo VARCHAR(20),
  dificuldade VARCHAR(20),
  embedding vector(1536),
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS historico_efetividade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pergunta_id UUID NOT NULL,
  cliente_id UUID NOT NULL,
  tipo_pergunta VARCHAR(20) NOT NULL,
  resultado VARCHAR(20) CHECK (resultado IN ('sucesso', 'falha')),
  taxa_conversao_incremental NUMERIC(5,4),
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS configuracao_cliente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID UNIQUE NOT NULL,
  nicho VARCHAR(50) NOT NULL,
  usar_genericas BOOLEAN DEFAULT TRUE,
  usar_personalizadas BOOLEAN DEFAULT TRUE,
  preferencia_tom VARCHAR(30) DEFAULT 'profissional',
  preferencia_dificuldade VARCHAR(20) DEFAULT 'media',
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_perguntas_genericas_nicho
  ON perguntas_genericas(nicho);
CREATE INDEX IF NOT EXISTS idx_perguntas_personalizadas_cliente
  ON perguntas_personalizadas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_historico_efetividade_pergunta
  ON historico_efetividade(pergunta_id);
