-- 010_prospeccao_audit.sql — Auditoria de disparos e importacao de prospeccao

CREATE TABLE IF NOT EXISTS prospeccao_dispatch_audit (
  id BIGSERIAL PRIMARY KEY,
  correlation_id VARCHAR(120) NOT NULL,
  cliente_id VARCHAR(80) NOT NULL,
  origem VARCHAR(120) NOT NULL,
  total INT NOT NULL DEFAULT 0,
  enqueued INT NOT NULL DEFAULT 0,
  failed INT NOT NULL DEFAULT 0,
  payload JSONB,
  resultado JSONB,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prospeccao_dispatch_audit_corr
  ON prospeccao_dispatch_audit(correlation_id);

CREATE INDEX IF NOT EXISTS idx_prospeccao_dispatch_audit_cliente
  ON prospeccao_dispatch_audit(cliente_id, criado_em DESC);
