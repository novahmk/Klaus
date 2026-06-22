# Sprint 0.5: Checklist de Execução e Validação

## ✅ Fase 0: Feature Flags (Completado)
- [x] Variáveis de flags adicionadas em `.env.example`
- [x] Defaults = false (rollout seguro)
- [x] Organizadas por sprint

---

## 🚀 Sprint 0.5: Bootstrap Supabase (Pronto para Execução)

### Arquivos Criados
- [x] `/src/infra/database/supabase-bootstrap.sql` - 13 tabelas + índices + comentários
- [x] `/src/infra/database/supabase-seed.sql` - 3 leads + 3 modelos + 6 configs
- [x] `/src/infra/database/supabase-rollback.sql` - Drop idempotente
- [x] `/src/infra/database/SUPABASE_INTEGRATION.md` - Guia de execução + troubleshooting
- [x] `.env.example` - Variáveis Supabase + flags

### Estrutura de Tabelas (13 total)
1. **leads_dashboard** - Estado do lead com controle manual
2. **mensagens** - Histórico inbound/outbound
3. **followup_config** - Config de follow-up por cliente
4. **followup_modelos** - Sequência de mensagens
5. **metricas_diarias** - Agregação diária
6. **cfg_persona** - Persona do bot
7. **cfg_objetivo** - Objetivo/missão
8. **cfg_abordagens** - Abordagens/estilos
9. **cfg_contexto** - Contexto de negócio
10. **cfg_tom_voz** - Tom de voz
11. **cfg_regras** - Regras/palavras-chave
12. **integration_status** - Status de módulos
13. *(future: possível extensão no legado)*

### Indices Criados
- `idx_leads_dashboard_controle_manual` - Para Sprint 2 (controle_manual queries)
- `idx_leads_dashboard_status` - Para Sprint 4 (elegibilidade follow-up)
- `idx_mensagens_lead_id_created` - Para histórico por lead
- `idx_mensagens_remetente_created` - Para análise por tipo
- `idx_followup_config_ativo` - Para config ativa
- `idx_followup_modelos_cliente_id_ordem` - Para sequência
- `idx_metricas_diarias_data` - Para queries de dashboard
- `idx_metricas_diarias_cliente_data` - Para performance

### Compatibilidade com Klaus
- ✅ Sem impacto: migrations 005_conversas, 006_leads, 007_pipeline_status intactas
- ✅ Rollback seguro: simples drop sem afetar legado
- ✅ Padronização: lead_id (VARCHAR 30), UTC timestamps, snake_case

---

## 📋 Como Executar no Supabase

### Passo 1: Login no Supabase
1. Ir para https://supabase.com/dashboard
2. Abrir projeto Klaus
3. Navegar para SQL Editor

### Passo 2: Executar Bootstrap
```
1. Copiar conteúdo de /src/infra/database/supabase-bootstrap.sql
2. Colar em SQL Editor
3. Clicar em "Run" ou Ctrl+Enter
4. Aguardar: "Executado com sucesso"
```

### Passo 3: Executar Seed
```
1. Copiar conteúdo de /src/infra/database/supabase-seed.sql
2. Colar em SQL Editor
3. Clicar em "Run"
4. Aguardar: "Executado com sucesso"
```

### Passo 4: Validar Tabelas
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' ORDER BY table_name;
-- Deve retornar 13 tabelas (cfg_*, followup_*, leads_dashboard, metricas_diarias, mensagens, integration_status)
```

### Passo 5: Validar Dados
```sql
SELECT COUNT(*) FROM leads_dashboard;
-- Deve retornar: 3

SELECT COUNT(*) FROM followup_modelos;
-- Deve retornar: 3

SELECT COUNT(*) FROM followup_config;
-- Deve retornar: 1
```

---

## ✅ Critérios de Aceite Sprint 0.5

### Deve Passar
- [ ] 13 tabelas criadas sem erro
- [ ] Índices criados com sucesso
- [ ] Seed retorna 3 leads + 3 modelos
- [ ] Query de elegibilidade < 300ms:
  ```sql
  SELECT ld.lead_id, ld.status 
  FROM leads_dashboard ld 
  WHERE ld.controle_manual = false 
    AND ld.status = 'aguardando'
  LIMIT 10;
  ```
- [ ] Upsert idempotente funciona:
  ```sql
  INSERT INTO metricas_diarias (cliente_id, data_referencia, total_leads) 
  VALUES ('test-client-001', CURRENT_DATE, 10) 
  ON CONFLICT (cliente_id, data_referencia) 
  DO UPDATE SET total_leads = 10;
  ```

---

## 🔙 Rollback (Se Necessário)

```
1. Copiar conteúdo de /src/infra/database/supabase-rollback.sql
2. Colar em SQL Editor
3. Clicar em "Run"
4. Verificar que tabelas do Klaus ainda existem:
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' AND table_name LIKE '005%' OR table_name LIKE '006%' OR table_name LIKE '007%';
```

---

## 📊 Próximas Dependências

- **Sprint 1 (Config Loader)** depende de Sprint 0.5 ✅
- **Sprint 2 (Inbound)** depende de Sprint 1
- **Sprint 3 (IA Dinâmica)** depende de Sprint 1
- **Sprint 4 (Follow-up)** depende de Sprint 2 + 3
- **Sprint 5 (Métricas)** depende de Sprint 0.5 + 4
- **Sprint 6 (Health Check)** depende de qualquer anterior

---

## 🎯 Status: PRONTO PARA EXECUÇÃO

**Criado em:** 2026-06-20  
**Versão:** 0.5  
**Próximo passo:** Executar scripts no Supabase Dashboard  
