# Railway Deploy Runbook

Este documento padroniza a subida do sistema no Railway para producao.

## 1) Servicos no Railway

Criar no mesmo projeto:
- 1 servico da aplicacao (este repositorio)
- 1 banco PostgreSQL
- 1 Redis

## 2) Build e runtime

- Runtime: Dockerfile da raiz
- Build: automatico pelo Railway
- Healthcheck: /health
- Restart policy: ON_FAILURE

Referencia de configuracao: `railway.toml`.

## 3) Variaveis obrigatorias

Aplicacao:
- NODE_ENV=production
- PORT=8080
- PROCESSING_MODE=queue
- LOG_LEVEL=info
- DEFAULT_CLIENTE_ID=default

OpenAI:
- OPENAI_API_KEY=<secret>
- OPENAI_MODEL_EMBEDDING=text-embedding-3-small
- OPENAI_MODEL_CHAT=gpt-4o-mini
- OPENAI_TEMPERATURE=0.7

WASender:
- WASENDERAPI_TOKEN=<secret>
- WASENDERAPI_BASE_URL=https://www.wasenderapi.com/api
- WASENDERAPI_WEBHOOK_SECRET=<secret>

Infra:
- DATABASE_URL=<referencia do PostgreSQL Railway>
- REDIS_URL=<referencia do Redis Railway>

## 4) Primeira subida

1. Fazer deploy da aplicacao.
2. Aguardar status healthy no servico.
3. Executar migracao no servico da aplicacao:

```bash
npm run migrate:prod
```

4. Revalidar healthcheck em /health.

## 5) Smoke test

Verificar no endpoint raiz:
- status = ok
- service = WASender Core
- openai = true (quando OPENAI_API_KEY configurada)

Verificar no endpoint /health:
- status = ok
- mode = queue

Verificar endpoints de prospeccao (com INTERNAL_API_KEY configurada):

```bash
curl -sS -H "x-internal-api-key: $INTERNAL_API_KEY" \
	"$APP_URL/api/prospeccao/contract"
```

```bash
curl -sS -X POST -H "content-type: application/json" \
	-H "x-internal-api-key: $INTERNAL_API_KEY" \
	"$APP_URL/api/prospeccao/check-duplicados" \
	-d '{"telefones":["11999998888"]}'
```

```bash
curl -sS -X POST -H "content-type: application/json" \
	-H "x-internal-api-key: $INTERNAL_API_KEY" \
	"$APP_URL/api/prospeccao/importar-leads" \
	-d '{"clienteId":"default","itens":[{"nome":"Teste","telefone":"11999998888"}]}'
```

```bash
curl -sS -X POST -H "content-type: application/json" \
	-H "x-internal-api-key: $INTERNAL_API_KEY" \
	"$APP_URL/api/prospeccao/manual-disparos" \
	-d '{"clienteId":"default","mensagem":"Ola!","itens":[{"telefone":"11999998888"}]}'
```

## 6) Troubleshooting rapido

Falha de healthcheck:
- Validar PORT e bind em 0.0.0.0
- Ver logs de inicializacao do servico

Falha de banco:
- Validar DATABASE_URL
- Executar novamente npm run migrate:prod

Falha de fila:
- Validar REDIS_URL
- Confirmar PROCESSING_MODE=queue

Falha OpenAI:
- Validar OPENAI_API_KEY
- Validar modelo OPENAI_MODEL_EMBEDDING

## 7) Seguranca obrigatoria

- Nao commitar secrets no repositorio.
- Usar apenas secrets do Railway para chaves de API.
- Configurar INTERNAL_API_KEY para proteger endpoints internos de prospeccao.
- Rotacionar imediatamente qualquer chave exposta.

## 8) Ativacao de recursos dinamicos (prompt, scoring e regras via Supabase)

Esses recursos ja existem no codigo (feature flags, default desligadas). Nao criar
novos arquivos/rotas para isso — apenas popular dados no Supabase e ligar as flags.

### 8.1 Pre-requisito: preparar dados no Supabase

1. Rodar `src/infra/database/supabase-bootstrap.sql` no SQL Editor do Supabase
   (se as tabelas `cfg_*` ainda nao existirem).
2. Rodar `src/infra/database/supabase-seed-dynamic.sql` no SQL Editor, ajustando
   o `cliente_id` (`'default'` por padrao) para o mesmo valor de `DEFAULT_CLIENTE_ID`
   usado no Railway. Preencher os campos `TODO:` de `cfg_persona`/`cfg_objetivo`/
   `cfg_contexto`/`cfg_abordagens` com o conteudo real do negocio antes de ativar
   `DYNAMIC_PROMPT_ENABLED`.
3. `cfg_regras_conversa` pode ficar vazia com seguranca (nenhuma acao e recomendada
   nesse caso). As condicoes SEMPRE sao avaliadas por whitelist estruturada
   (`src/modules/regras-conversa/evaluator.ts`) — nunca usar `eval`/`new Function`
   para regras vindas do banco.

### 8.2 Variaveis a adicionar no Railway (alem das da secao 3)

- SUPABASE_ENABLED=true
- CONFIG_LOADER_ENABLED=true
- CONFIG_CACHE_TTL_MS=300000
- DYNAMIC_PROMPT_ENABLED=true
- DYNAMIC_SCORING_ENABLED=true
- DYNAMIC_RULES_ENABLED=true
- HEALTH_CHECK_SUPABASE_ENABLED=true (opcional, expoe check do Supabase em /health)

### 8.3 Validacao pos-deploy

1. Logs de subida devem mostrar `ConfigLoader: refresh periodico iniciado` e nenhum
   erro de conexao com o Supabase.
2. `GET /health` deve retornar status ok (incluindo Supabase, se o check estiver ligado).
3. Enviar uma mensagem de teste via WhatsApp e conferir nos logs:
   - Componente 5 usando prompt dinamico (nao vazio).
   - Componente 6 aplicando pesos/thresholds de `cfg_scoring`.
   - Componente 7 preenchendo `metadata.acaoRecomendada` quando uma regra de
     `cfg_regras_conversa` bater a condicao.
4. Rollback rapido: voltar qualquer uma das flags `DYNAMIC_*`/`CONFIG_LOADER_ENABLED`
   para `false` no Railway — os componentes tem fallback para os valores hardcoded
   e nunca ficam bloqueados por falha do Supabase.
