-- Sprints 1/3/7/8: Seed de ativação de recursos dinâmicos (dashboard) em produção
-- Arquivo: supabase-seed-dynamic.sql
-- Objetivo: popular as tabelas cfg_* para o cliente_id usado em PRODUÇÃO, para que
-- as feature flags DYNAMIC_PROMPT_ENABLED / DYNAMIC_SCORING_ENABLED /
-- DYNAMIC_RULES_ENABLED tenham efeito real ao serem ativadas no Railway.
--
-- Pré-requisito: supabase-bootstrap.sql já executado (cria as tabelas).
--
-- IMPORTANTE: troque 'default' abaixo pelo valor real de DEFAULT_CLIENTE_ID
-- configurado no Railway (ou pelo clienteId enviado no payload do webhook
-- WASender, se houver múltiplos clientes). Todas as linhas usam
-- ON CONFLICT DO NOTHING / DO UPDATE para serem seguras de re-executar.

-- ========================================
-- 1. cfg_persona / cfg_objetivo / cfg_abordagens / cfg_contexto / cfg_tom_voz / cfg_regras
--    (Sprint 1/3: prompt dinâmico) — CONTEÚDO PLACEHOLDER, ajustar para o negócio real
--    antes de ativar DYNAMIC_PROMPT_ENABLED=true em produção.
-- ========================================

INSERT INTO cfg_persona (cliente_id, nome, descricao, cargo_alvo)
VALUES ('default', 'TODO: nome da persona', 'TODO: descrição da persona (tom, papel)', 'TODO: cargo-alvo dos leads')
ON CONFLICT (cliente_id) DO NOTHING;

INSERT INTO cfg_objetivo (cliente_id, descricao, objetivo_curto, objetivo_longo)
VALUES ('default', 'TODO: objetivo geral da conversa', 'TODO: objetivo de curto prazo', 'TODO: objetivo de longo prazo')
ON CONFLICT (cliente_id) DO NOTHING;

INSERT INTO cfg_abordagens (cliente_id, abordagens, evitar)
VALUES ('default', ARRAY['consultiva', 'informativa'], ARRAY['agressiva', 'spammy'])
ON CONFLICT (cliente_id) DO NOTHING;

INSERT INTO cfg_contexto (cliente_id, contexto_empresa, contexto_industria, contexto_mercado)
VALUES ('default', 'TODO: contexto da empresa', 'TODO: indústria', 'TODO: contexto de mercado')
ON CONFLICT (cliente_id) DO NOTHING;

INSERT INTO cfg_tom_voz (cliente_id, tom_geral, tom_executivo, tom_tecnico, tom_suporte)
VALUES ('default', 'profissional', 'formal', 'detalhado', 'amavel')
ON CONFLICT (cliente_id) DO NOTHING;

INSERT INTO cfg_regras (cliente_id, regras, palavras_chave_bloqueadas, palavras_chave_obrigatorias)
VALUES ('default', ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[])
ON CONFLICT (cliente_id) DO NOTHING;

-- ========================================
-- 2. cfg_scoring (Sprint 7: scoring dinâmico)
--    Valores abaixo são IDÊNTICOS aos defaults hardcoded em
--    src/components/6-qualificacao/constants.ts — ativar DYNAMIC_SCORING_ENABLED=true
--    com esta linha não muda nenhum comportamento até que os valores sejam
--    customizados via dashboard/SQL.
-- ========================================

INSERT INTO cfg_scoring (
  cliente_id, peso_intencao, peso_engajamento, peso_contexto, peso_historico,
  scores_intencao, threshold_handoff, threshold_notificacao
)
VALUES (
  'default', 0.4, 0.3, 0.2, 0.1,
  '{
    "QUER_AGENDAR": 100,
    "DEMONSTRA_INTERESSE": 80,
    "QUER_MAIS_INFO": 60,
    "TEM_OBJECAO": 40,
    "NAO_RESPONDEU": 20,
    "NAO_INTERESSADO": 0
  }'::jsonb,
  90, 70
)
ON CONFLICT (cliente_id) DO NOTHING;

-- ========================================
-- 3. cfg_regras_conversa (Sprint 8: regras condição -> ação, sem eval)
--    Tabela pode ficar VAZIA com segurança: avaliarRegras() retorna null e o
--    orquestrador simplesmente não define metadata.acaoRecomendada.
--    Modelo de INSERT abaixo fica comentado — descomente e ajuste
--    campo/operador/valor/ação conforme a regra de negócio desejada.
--    Whitelist válida (ver src/modules/regras-conversa/evaluator.ts):
--      condicao_campo:    'score' | 'estagio' | 'tentativas'
--      condicao_operador: '>' | '>=' | '<' | '<=' | '==' | '!='
-- ========================================

-- INSERT INTO cfg_regras_conversa (
--   cliente_id, nome, condicao_campo, condicao_operador, condicao_valor,
--   acao, score_impacto, ordem, ativo
-- )
-- VALUES (
--   'default', 'TODO: nome da regra', 'score', '>=', '90',
--   'TODO: ação a executar', 0, 1, true
-- )
-- ON CONFLICT DO NOTHING;

-- ========================================
-- FIM SEED DINÂMICO
-- ========================================
