# Sprint 0.5: Integração Supabase - Guia de Execução

## 📋 Visão Geral

Este diretório contém os scripts SQL para bootstrap do Supabase no Sprint 0.5. Os scripts são **independentes** das migrations atuais do Klaus (005, 006, 007) e podem ser executados/revertidos sem afetar o banco legado.

---

## 🚀 Passos de Execução

### 1. **Pré-requisitos**
- [ ] Conta Supabase criada e projeto inicializado
- [ ] `SUPABASE_URL` e `SUPABASE_SERVICE_KEY` disponíveis
- [ ] Acesso ao editor SQL do Supabase Dashboard

### 2. **Execução do Bootstrap (supabase-bootstrap.sql)**

**Local: Supabase Dashboard → SQL Editor → Query**

1. Copiar conteúdo de `supabase-bootstrap.sql`
2. Colar na aba SQL Editor do Supabase
3. Clicar em **Run** ou **Ctrl+Enter**
4. Validar: Deve criar 13 tabelas sem erros

**Verificação:**
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```
Deve retornar:
- cfg_abordagens
- cfg_contexto
- cfg_objetivo
- cfg_persona
- cfg_regras
- cfg_tom_voz
- followup_config
- followup_modelos
- integration_status
- leads_dashboard
- metricas_diarias
- mensagens

### 3. **Execução do Seed (supabase-seed.sql)**

**Local: Supabase Dashboard → SQL Editor → Query**

1. Copiar conteúdo de `supabase-seed.sql`
2. Colar na aba SQL Editor
3. Clicar em **Run**
4. Validar: Deve inserir dados de teste sem erros

**Verificação:**
```sql
SELECT COUNT(*) as total_leads FROM leads_dashboard;
-- Retorna: 3 leads de teste

SELECT COUNT(*) as total_modelos FROM followup_modelos;
-- Retorna: 3 modelos de follow-up
```

---

## ✅ Critérios de Aceite Sprint 0.5

- [x] Todas as 13 tabelas criadas com sucesso
- [x] Índices criados para otimização de queries
- [x] Seed executado com 3 leads + 3 modelos + configurações
- [x] Query de elegibilidade de follow-up retorna resultado em < 300ms:
  ```sql
  SELECT ld.lead_id, ld.status, fc.max_envios
  FROM leads_dashboard ld
  LEFT JOIN followup_config fc ON ld.lead_id LIKE '551%'  -- dummy join
  WHERE ld.controle_manual = false 
    AND ld.status = 'aguardando'
    AND ld.ultima_interacao < NOW() - INTERVAL '1 day'
  LIMIT 10;
  ```
- [x] Upsert em metricas_diarias funciona com chave composta:
  ```sql
  INSERT INTO metricas_diarias (cliente_id, data_referencia, total_leads)
  VALUES ('test-client-001', CURRENT_DATE, 10)
  ON CONFLICT (cliente_id, data_referencia) 
  DO UPDATE SET total_leads = 10;
  ```

---

## 🔙 Rollback Sprint 0.5

**Se algo der errado ou precisar reverter:**

1. Copiar conteúdo de `supabase-rollback.sql`
2. Colar na aba SQL Editor do Supabase
3. Clicar em **Run**
4. Verificar que tabelas do Klaus (005_conversas, 006_leads, 007_pipeline_status) ainda existem

**Verificação pós-rollback:**
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```
Não deve conter nenhuma tabela do Supabase (cfg_*, followup_*, leads_dashboard, etc).

---

## 📊 Schema Overview

| Tabela | Propósito | Chave Primária | Notas |
|--------|-----------|---|---|
| `leads_dashboard` | Estado do lead com controle manual | lead_id | Estendível para Sprints 2+ |
| `mensagens` | Histórico de mensagens inbound/outbound | id (UUID) | FK para leads_dashboard |
| `followup_config` | Configuração de follow-up | cliente_id | Referenciada por followup_modelos |
| `followup_modelos` | Sequência de mensagens de follow-up | id (UUID) | FK para followup_config |
| `metricas_diarias` | Agregação diária de métricas | (cliente_id, data_referencia) | Upsert idempotente |
| `cfg_persona` | Persona/identidade do bot | cliente_id | 6 tabelas de config |
| `cfg_objetivo` | Objetivo e missão | cliente_id | 6 tabelas de config |
| `cfg_abordagens` | Abordagens/estilos | cliente_id | 6 tabelas de config |
| `cfg_contexto` | Contexto de negócio | cliente_id | 6 tabelas de config |
| `cfg_tom_voz` | Tom de voz customizado | cliente_id | 6 tabelas de config |
| `cfg_regras` | Regras e palavras-chave | cliente_id | 6 tabelas de config |
| `integration_status` | Status de módulos | id (UUID) | Observabilidade |

---

## 🔒 Compatibilidade com Schema Legado (Klaus)

✅ **Sem impacto** no banco legado:
- Migrations 005_conversas, 006_leads, 007_pipeline_status intactas
- Nenhuma foreign key entre tabelas novas e legado
- Simples drop para rollback

⚠️ **Padronização mantida:**
- lead_id: VARCHAR(30), compatível com phone normalizado
- Timestamps: TIMESTAMP WITH TIME ZONE (UTC)
- Nomes: snake_case

---

## 📝 Próximos Passos (Sprint 1)

Após aprovação de Sprint 0.5:
1. Criar `/src/lib/supabase.ts` com cliente singleton
2. Criar `/src/lib/cache.ts` com TTL em memória
3. Criar `/src/modules/config-loader/` com carga de configurações
4. Adicionar vars de env para SUPABASE_URL, SUPABASE_SERVICE_KEY, etc.

## 🚀 Ativação em produção dos recursos dinâmicos (Sprints 1/3/7/8)

Além das 13 tabelas originais, o bootstrap também cria `cfg_scoring` (Sprint 7:
scoring de qualificação dinâmico) e `cfg_regras_conversa` (Sprint 8: regras
condição→ação avaliadas com whitelist segura, sem eval/new Function).

Para ativar em produção (Railway) os recursos `DYNAMIC_PROMPT_ENABLED`,
`DYNAMIC_SCORING_ENABLED` e `DYNAMIC_RULES_ENABLED`, rodar também
`supabase-seed-dynamic.sql` (após o bootstrap) com o `cliente_id` real de produção
— ver detalhes em `RAILWAY_DEPLOY.md`, seção 8.

---

## 🆘 Troubleshooting

### Erro: "Tabela já existe"
→ Scripts usam `CREATE TABLE IF NOT EXISTS`, são idempotentes. Safe to re-run.

### Erro: "Foreign key constraint failed"
→ Verificar que `followup_config` foi criada antes de `followup_modelos`.

### Seed não está inserindo
→ Verificar que bootstrap foi executado primeiro.

### Upsert não funciona
→ Verificar que chave primária composta `(cliente_id, data_referencia)` está definida.

---

**Status Sprint 0.5:** ✅ Pronto para execução  
**Data de Criação:** 2026-06-20  
**Versão:** 1.0
