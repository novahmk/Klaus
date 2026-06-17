-- 004_qualificacao.sql — Componente 6: Qualificação de Leads
CREATE TABLE IF NOT EXISTS qualificacoes_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL,
  lead_id UUID NOT NULL,
  score_qualificacao NUMERIC(5,2),
  prioridade INT CHECK (prioridade BETWEEN 1 AND 10),
  estagio VARCHAR(50),
  intencao VARCHAR(50),
  recomendacao TEXT,
  notificacoes_enviadas JSONB,
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS historico_notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL,
  lead_id UUID NOT NULL,
  tipo_notificacao VARCHAR(20),
  numero_atendente VARCHAR(20),
  mensagem TEXT,
  status VARCHAR(20),
  timestamp_envio TIMESTAMP DEFAULT NOW(),
  timestamp_leitura TIMESTAMP
);

CREATE TABLE IF NOT EXISTS configuracao_notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID UNIQUE NOT NULL,
  numero_whatsapp_atendente VARCHAR(20),
  email_atendente VARCHAR(100),
  habilitar_whatsapp BOOLEAN DEFAULT TRUE,
  habilitar_dashboard BOOLEAN DEFAULT TRUE,
  habilitar_email BOOLEAN DEFAULT FALSE,
  score_minimo_notificacao INT DEFAULT 70,
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qualificacao_lead ON qualificacoes_leads(lead_id);
CREATE INDEX IF NOT EXISTS idx_qualificacao_score ON qualificacoes_leads(score_qualificacao DESC);
CREATE INDEX IF NOT EXISTS idx_notificacao_status ON historico_notificacoes(status);
