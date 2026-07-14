-- Sprint 0.5: Rollback do Bootstrap do Supabase
-- Arquivo: supabase-rollback.sql
-- Desfaz APENAS o que foi criado em supabase-bootstrap.sql
-- CUIDADO: Executar somente em caso de rollback completo do Sprint 0.5

-- ========================================
-- DROP TABLES (ordem reversa de dependência)
-- ========================================

-- Drop tabelas que têm foreign keys
DROP TABLE IF EXISTS followup_modelos CASCADE;
DROP TABLE IF EXISTS mensagens CASCADE;

-- Drop tabelas independentes
DROP TABLE IF EXISTS leads_dashboard CASCADE;
DROP TABLE IF EXISTS followup_config CASCADE;
DROP TABLE IF EXISTS metricas_diarias CASCADE;
DROP TABLE IF EXISTS cfg_persona CASCADE;
DROP TABLE IF EXISTS cfg_objetivo CASCADE;
DROP TABLE IF EXISTS cfg_abordagens CASCADE;
DROP TABLE IF EXISTS cfg_contexto CASCADE;
DROP TABLE IF EXISTS cfg_tom_voz CASCADE;
DROP TABLE IF EXISTS cfg_regras CASCADE;
DROP TABLE IF EXISTS cfg_scoring CASCADE;
DROP TABLE IF EXISTS cfg_regras_conversa CASCADE;
DROP TABLE IF EXISTS integration_status CASCADE;

-- ========================================
-- Verificação: Se conseguiu chegar aqui, o rollback foi bem-sucedido
-- ========================================
-- Tabelas restantes (devem ser tabelas legadas do Klaus, não devem estar vazias):
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;

-- ========================================
-- FIM ROLLBACK
-- ========================================
