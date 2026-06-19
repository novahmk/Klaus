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
- Rotacionar imediatamente qualquer chave exposta.
