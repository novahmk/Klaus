-- 001_busca_banco.sql — Componente 3: Busca no Banco de Dados
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS base_conhecimento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL,
  tema VARCHAR(255) NOT NULL,
  descricao TEXT NOT NULL,
  beneficios TEXT[] DEFAULT ARRAY[]::TEXT[],
  preco VARCHAR(100),
  diferenciais TEXT[] DEFAULT ARRAY[]::TEXT[],
  casos_de_uso TEXT[] DEFAULT ARRAY[]::TEXT[],
  embedding vector(1536),
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS objecoes_padrao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objecao VARCHAR(255) NOT NULL,
  palavras_chave TEXT[] DEFAULT ARRAY[]::TEXT[],
  resposta TEXT NOT NULL,
  taxa_efetividade FLOAT DEFAULT 0.5,
  embedding vector(1536),
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS objecoes_personalizadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL,
  objecao VARCHAR(255) NOT NULL,
  palavras_chave TEXT[] DEFAULT ARRAY[]::TEXT[],
  resposta TEXT NOT NULL,
  taxa_efetividade FLOAT DEFAULT 0.5,
  embedding vector(1536),
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS uso_respostas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL,
  lead_id UUID NOT NULL,
  resposta_id UUID NOT NULL,
  tipo_resposta VARCHAR(50),
  resultado BOOLEAN,
  criado_em TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_base_conhecimento_cliente_tema
  ON base_conhecimento(cliente_id, tema);
CREATE INDEX IF NOT EXISTS idx_objecoes_padrao_objecao
  ON objecoes_padrao(objecao);
CREATE INDEX IF NOT EXISTS idx_objecoes_personalizadas_cliente
  ON objecoes_personalizadas(cliente_id, objecao);
CREATE INDEX IF NOT EXISTS idx_base_conhecimento_embedding
  ON base_conhecimento USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_objecoes_embedding
  ON objecoes_personalizadas USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_uso_respostas_cliente_lead
  ON uso_respostas(cliente_id, lead_id);
