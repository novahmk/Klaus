-- ============================================================
-- DATABASE SCHEMA — Klaus V2
-- ============================================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---- Leads -------------------------------------------------

CREATE TABLE IF NOT EXISTS leads (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id   TEXT,
  name          TEXT,
  email         TEXT,
  phone         TEXT,
  status        TEXT NOT NULL DEFAULT 'NEW',
  score         INTEGER NOT NULL DEFAULT 0,
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_external_id ON leads (external_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads (status);

-- ---- Messages ----------------------------------------------

CREATE TABLE IF NOT EXISTS messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id     UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  intent      TEXT,
  embedding   vector(1536),
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_lead_id ON messages (lead_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_embedding ON messages USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ---- Knowledge Base ----------------------------------------

CREATE TABLE IF NOT EXISTS knowledge_entries (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id   TEXT NOT NULL,
  source      TEXT NOT NULL,
  content     TEXT NOT NULL,
  embedding   vector(1536) NOT NULL,
  effectiveness FLOAT NOT NULL DEFAULT 0.0,
  usage_count INTEGER NOT NULL DEFAULT 0,
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_client ON knowledge_entries (client_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_source ON knowledge_entries (source);
CREATE INDEX IF NOT EXISTS idx_knowledge_embedding ON knowledge_entries USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ---- Qualification History ---------------------------------

CREATE TABLE IF NOT EXISTS qualification_history (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id     UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  score       INTEGER NOT NULL,
  justification TEXT NOT NULL,
  handoff     BOOLEAN NOT NULL DEFAULT FALSE,
  trigger     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qual_lead_id ON qualification_history (lead_id);

-- ---- Conversation Sessions ---------------------------------

CREATE TABLE IF NOT EXISTS conversation_sessions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id     UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  client_id   TEXT NOT NULL,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at    TIMESTAMPTZ,
  metadata    JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_sessions_lead_id ON conversation_sessions (lead_id);
