-- Sprint 0.5: Bootstrap do Supabase para Dashboard Integration
-- Arquivo: supabase-bootstrap.sql
-- Nota: Executar SOMENTE no Supabase. Não altera banco legado Klaus.
-- Criação de tabelas mínimas para dashboard, follow-up, métricas e configurações.

-- ========================================
-- 1. LEADS_DASHBOARD - Estado do lead (integração com dashboard)
-- ========================================
CREATE TABLE IF NOT EXISTS leads_dashboard (
  lead_id VARCHAR(30) PRIMARY KEY,
  controle_manual BOOLEAN DEFAULT FALSE,
  ultima_mensagem TEXT,
  ultima_interacao TIMESTAMP WITH TIME ZONE,
  status VARCHAR(30) DEFAULT 'ativo',
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_dashboard_controle_manual
  ON leads_dashboard(controle_manual, status, ultima_interacao DESC);

CREATE INDEX IF NOT EXISTS idx_leads_dashboard_status
  ON leads_dashboard(status, atualizado_em DESC);

-- ========================================
-- 2. MENSAGENS - Histórico de mensagens (inbound/outbound)
-- ========================================
CREATE TABLE IF NOT EXISTS mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id VARCHAR(30) NOT NULL REFERENCES leads_dashboard(lead_id) ON DELETE CASCADE,
  remetente VARCHAR(20) NOT NULL CHECK (remetente IN ('lead', 'ia', 'humano')),
  conteudo TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mensagens_lead_id_created
  ON mensagens(lead_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mensagens_remetente_created
  ON mensagens(remetente, created_at DESC);

-- ========================================
-- 3. FOLLOWUP_CONFIG - Configuração de follow-up por cliente
-- ========================================
CREATE TABLE IF NOT EXISTS followup_config (
  cliente_id VARCHAR(50) PRIMARY KEY,
  intervalo_dias INT DEFAULT 1,
  horario_inicio INT DEFAULT 8,  -- 8:00
  horario_fim INT DEFAULT 20,    -- 20:00
  parar_fins_semana BOOLEAN DEFAULT FALSE,
  max_envios INT DEFAULT 5,
  ativo BOOLEAN DEFAULT TRUE,
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_followup_config_ativo
  ON followup_config(ativo);

-- ========================================
-- 4. FOLLOWUP_MODELOS - Modelos de mensagens de follow-up
-- ========================================
CREATE TABLE IF NOT EXISTS followup_modelos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id VARCHAR(50) NOT NULL REFERENCES followup_config(cliente_id) ON DELETE CASCADE,
  ordem INT NOT NULL,
  titulo VARCHAR(150),
  texto TEXT NOT NULL,
  ativo BOOLEAN DEFAULT TRUE,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_followup_modelos_cliente_id_ordem
  ON followup_modelos(cliente_id, ordem);

CREATE INDEX IF NOT EXISTS idx_followup_modelos_cliente_id_ativo
  ON followup_modelos(cliente_id, ativo);

-- ========================================
-- 5. METRICAS_DIARIAS - Agregação de métricas por dia/cliente
-- ========================================
CREATE TABLE IF NOT EXISTS metricas_diarias (
  cliente_id VARCHAR(50) NOT NULL,
  data_referencia DATE NOT NULL,
  total_leads INT DEFAULT 0,
  leads_ativos INT DEFAULT 0,
  leads_em_controle_manual INT DEFAULT 0,
  total_mensagens INT DEFAULT 0,
  total_ia_respostas INT DEFAULT 0,
  total_followups_enviados INT DEFAULT 0,
  leads_convertidos INT DEFAULT 0,
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (cliente_id, data_referencia)
);

CREATE INDEX IF NOT EXISTS idx_metricas_diarias_data
  ON metricas_diarias(data_referencia DESC);

CREATE INDEX IF NOT EXISTS idx_metricas_diarias_cliente_data
  ON metricas_diarias(cliente_id, data_referencia DESC);

-- ========================================
-- 6. CONFIGURAÇÕES DO PROMPT (6 tabelas de configuração)
-- ========================================

-- 6.1 cfg_persona
CREATE TABLE IF NOT EXISTS cfg_persona (
  cliente_id VARCHAR(50) PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  descricao TEXT,
  cargo_alvo VARCHAR(150),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6.2 cfg_objetivo
CREATE TABLE IF NOT EXISTS cfg_objetivo (
  cliente_id VARCHAR(50) PRIMARY KEY,
  descricao TEXT NOT NULL,
  objetivo_curto TEXT,
  objetivo_longo TEXT,
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6.3 cfg_abordagens
CREATE TABLE IF NOT EXISTS cfg_abordagens (
  cliente_id VARCHAR(50) PRIMARY KEY,
  abordagens TEXT[] DEFAULT ARRAY['consultiva', 'informativa'],
  evitar TEXT[] DEFAULT ARRAY['agressiva', 'spammy'],
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6.4 cfg_contexto
CREATE TABLE IF NOT EXISTS cfg_contexto (
  cliente_id VARCHAR(50) PRIMARY KEY,
  contexto_empresa TEXT,
  contexto_industria TEXT,
  contexto_mercado TEXT,
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6.5 cfg_tom_voz
CREATE TABLE IF NOT EXISTS cfg_tom_voz (
  cliente_id VARCHAR(50) PRIMARY KEY,
  tom_geral VARCHAR(50) DEFAULT 'profissional',
  tom_executivo VARCHAR(50) DEFAULT 'formal',
  tom_tecnico VARCHAR(50) DEFAULT 'detalhado',
  tom_suporte VARCHAR(50) DEFAULT 'amavel',
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6.6 cfg_regras
CREATE TABLE IF NOT EXISTS cfg_regras (
  cliente_id VARCHAR(50) PRIMARY KEY,
  regras TEXT[] DEFAULT ARRAY[],
  palavras_chave_bloqueadas TEXT[] DEFAULT ARRAY[],
  palavras_chave_obrigatorias TEXT[] DEFAULT ARRAY[],
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- 7. TABELA DE CONTROLE - Rastreamento de integrações
-- ========================================
CREATE TABLE IF NOT EXISTS integration_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'inicializado',
  ultima_sincronizacao TIMESTAMP WITH TIME ZONE,
  ultima_verificacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  detalhes JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_integration_status_modulo
  ON integration_status(modulo);

-- ========================================
-- COMENTÁRIOS E METADADOS
-- ========================================
COMMENT ON TABLE leads_dashboard IS 'Estado do lead com flag de controle manual e última interação';
COMMENT ON TABLE mensagens IS 'Histórico de mensagens de inbound/outbound por lead';
COMMENT ON TABLE followup_config IS 'Configuração global de follow-up por cliente';
COMMENT ON TABLE followup_modelos IS 'Modelos de mensagens para sequência de follow-up';
COMMENT ON TABLE metricas_diarias IS 'Agregação diária de métricas de funil por cliente';
COMMENT ON TABLE cfg_persona IS 'Configuração de persona/identidade do bot por cliente';
COMMENT ON TABLE cfg_objetivo IS 'Configuração de objetivo e missão por cliente';
COMMENT ON TABLE cfg_abordagens IS 'Abordagens e estilos recomendados/bloqueados';
COMMENT ON TABLE cfg_contexto IS 'Contexto de empresa, indústria e mercado';
COMMENT ON TABLE cfg_tom_voz IS 'Tom de voz customizado por função (executivo, técnico, suporte)';
COMMENT ON TABLE cfg_regras IS 'Regras, palavras-chave bloqueadas e obrigatórias';
COMMENT ON TABLE integration_status IS 'Status de integração de módulos do dashboard';

-- ========================================
-- FIM BOOTSTRAP
-- ========================================
