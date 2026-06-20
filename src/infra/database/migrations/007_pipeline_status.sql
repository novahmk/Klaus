-- 007_pipeline_status.sql — Trilha de auditoria do pipeline de mensagens
-- Estados: recebida → enfileirada → processando_ia → enviada → erro
-- Append-only: cada transição gera um INSERT (não há UPDATE).
CREATE TABLE IF NOT EXISTS pipeline_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id VARCHAR(255),
  correlation_id VARCHAR(255),
  lead_id VARCHAR(30),
  cliente_id VARCHAR(50),
  etapa VARCHAR(30) NOT NULL,
  erro_detalhe TEXT,
  job_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_status_correlation
  ON pipeline_status(correlation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pipeline_status_message
  ON pipeline_status(message_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pipeline_status_etapa
  ON pipeline_status(etapa, created_at DESC);
