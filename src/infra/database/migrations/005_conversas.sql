-- 005_conversas.sql — Auditoria de conversas + deduplicação de mensagens
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(30) NOT NULL,
  role VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  media_type VARCHAR(20) DEFAULT 'text',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mensagens_processadas (
  message_id VARCHAR(255) PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_phone_created
  ON conversations(phone, created_at DESC);
