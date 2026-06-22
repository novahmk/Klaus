-- Sprint 0.5: Seed de Homologação do Supabase
-- Arquivo: supabase-seed.sql
-- Insere dados mínimos para testes iniciais do Sprint 0.5 e Sprint 1.

-- ========================================
-- 1. SEED: Cliente de Teste
-- ========================================
INSERT INTO followup_config (cliente_id, intervalo_dias, horario_inicio, horario_fim, parar_fins_semana, max_envios, ativo)
VALUES ('test-client-001', 1, 8, 20, true, 5, true)
ON CONFLICT DO NOTHING;

-- ========================================
-- 2. SEED: Leads de Teste
-- ========================================
INSERT INTO leads_dashboard (lead_id, controle_manual, status, ultima_interacao)
VALUES 
  ('5511999999999', false, 'ativo', NOW()),
  ('5511999999998', true, 'ativo', NOW()),
  ('5511999999997', false, 'aguardando', NOW() - INTERVAL '2 days')
ON CONFLICT DO NOTHING;

-- ========================================
-- 3. SEED: Modelos de Follow-up
-- ========================================
INSERT INTO followup_modelos (cliente_id, ordem, titulo, texto, ativo)
VALUES 
  ('test-client-001', 1, 'Follow-up 1', 'Olá! Como foi? Gostaria de saber se você teve tempo para avaliar nossa proposta. Estou à disposição para qualquer dúvida! 😊', true),
  ('test-client-001', 2, 'Follow-up 2', 'Notei que você ainda não respondeu. Talvez tenha ficado ocupado? Deixei a proposta disponível. Quando você tiver um momento, é só me chamar!', true),
  ('test-client-001', 3, 'Follow-up 3', 'Última tentativa: se não conseguir avançar agora, podemos remarcar para uma época mais tranquila para você. O que acha?', true)
ON CONFLICT DO NOTHING;

-- ========================================
-- 4. SEED: Configuração de Persona
-- ========================================
INSERT INTO cfg_persona (cliente_id, nome, descricao, cargo_alvo)
VALUES ('test-client-001', 'SDR Consultivo', 'Representante vendedor que aborda problemas com empatia e análise', 'CEO, Diretor de TI')
ON CONFLICT DO NOTHING;

-- ========================================
-- 5. SEED: Configuração de Objetivo
-- ========================================
INSERT INTO cfg_objetivo (cliente_id, descricao, objetivo_curto, objetivo_longo)
VALUES ('test-client-001', 'Qualificar e agendar demos', 'Gerar 5 datas agendadas por semana', 'Construir pipeline robusto de 100+ opportunities qualificadas')
ON CONFLICT DO NOTHING;

-- ========================================
-- 6. SEED: Configuração de Abordagens
-- ========================================
INSERT INTO cfg_abordagens (cliente_id, abordagens, evitar)
VALUES ('test-client-001', ARRAY['consultiva', 'problema-solução'], ARRAY['agressiva', 'genérica', 'spammy'])
ON CONFLICT DO NOTHING;

-- ========================================
-- 7. SEED: Configuração de Contexto
-- ========================================
INSERT INTO cfg_contexto (cliente_id, contexto_empresa, contexto_industria, contexto_mercado)
VALUES ('test-client-001', 'SaaS B2B focado em automação', 'Software e Tecnologia', 'Mercado crescente, competição alta, demanda por eficiência')
ON CONFLICT DO NOTHING;

-- ========================================
-- 8. SEED: Configuração de Tom de Voz
-- ========================================
INSERT INTO cfg_tom_voz (cliente_id, tom_geral, tom_executivo, tom_tecnico, tom_suporte)
VALUES ('test-client-001', 'profissional', 'direto e assertivo', 'preciso e técnico', 'empático e prestativo')
ON CONFLICT DO NOTHING;

-- ========================================
-- 9. SEED: Configuração de Regras
-- ========================================
INSERT INTO cfg_regras (cliente_id, regras, palavras_chave_bloqueadas, palavras_chave_obrigatorias)
VALUES (
  'test-client-001',
  ARRAY['Sempre mencionar resultado de cliente', 'Perguntar antes de descartar lead', 'Oferecer valor antes de pedir'],
  ARRAY['promoção relâmpago', 'últimas vagas', 'urgente!!!'],
  ARRAY['resultado', 'valor', 'próximo passo']
)
ON CONFLICT DO NOTHING;

-- ========================================
-- 10. SEED: Status de Integração
-- ========================================
INSERT INTO integration_status (modulo, status, ultima_sincronizacao, detalhes)
VALUES 
  ('supabase-bootstrap', 'inicializado', NOW(), '{"versao": "0.5", "tabelas": 13}'::jsonb),
  ('config-loader', 'pendente', NULL, '{"status": "aguardando sprint 1"}'::jsonb),
  ('inbound-sync', 'pendente', NULL, '{"status": "aguardando sprint 2"}'::jsonb),
  ('dynamic-prompt', 'pendente', NULL, '{"status": "aguardando sprint 3"}'::jsonb)
ON CONFLICT DO NOTHING;

-- ========================================
-- FIM SEED
-- ========================================
