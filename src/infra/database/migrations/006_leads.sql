-- 006_leads.sql — Estado do lead (médio/longo prazo)
CREATE TABLE IF NOT EXISTS leads (
  lead_id VARCHAR(30) PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  nome VARCHAR(150),
  telefone VARCHAR(30),
  email VARCHAR(150),
  etapa_funil VARCHAR(30) DEFAULT 'novo',
  status VARCHAR(30),
  intencao VARCHAR(50),
  score NUMERIC(6,2) DEFAULT 0,
  lead_score NUMERIC(6,2) DEFAULT 0,
  temperatura VARCHAR(20) DEFAULT 'cold',
  nivel_qualificacao VARCHAR(20) DEFAULT 'novo',
  interesse_principal VARCHAR(100),
  motivo_recusa TEXT,
  segmento_remarketing VARCHAR(50),
  tentativas_remarketing INT DEFAULT 0,
  convertido_via_remarketing BOOLEAN DEFAULT FALSE,
  data_conversao TIMESTAMP WITH TIME ZONE,
  procedimento_interesse VARCHAR(100),
  resumo_conversa TEXT,
  agendado_em TIMESTAMP WITH TIME ZONE,
  follow_up_count INT DEFAULT 0,
  follow_up_proximo TIMESTAMP WITH TIME ZONE,
  follow_up_sequencia VARCHAR(50),
  follow_up_step INT DEFAULT 0,
  redirecionado_comercial BOOLEAN DEFAULT FALSE,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_etapa_funil ON leads(etapa_funil);
CREATE INDEX IF NOT EXISTS idx_leads_temperatura ON leads(temperatura);
CREATE INDEX IF NOT EXISTS idx_leads_lead_score ON leads(lead_score DESC);
