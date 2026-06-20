# Contrato API - Prospeccao

Versao: `2026-06-20.1`

## 1) Disparo manual em lote

- Metodo: `POST`
- Rota: `/api/prospeccao/manual-disparos`
- Auth: header `x-internal-api-key` quando `INTERNAL_API_KEY` estiver configurada

### Payload

```json
{
  "clienteId": "cliente-123",
  "origem": "Disparo manual",
  "correlationId": "manual-abc",
  "mensagem": "Oi! Posso te mostrar uma proposta rapida?",
  "itens": [
    {
      "telefone": "11999998888",
      "nome": "Joao",
      "metadata": {
        "canal": "lovable"
      }
    },
    {
      "telefone": "+5511988887777",
      "mensagem": "Mensagem especifica para este lead"
    }
  ]
}
```

### Regras

- Lote maximo: `MANUAL_DISPATCH_MAX_BATCH` (default `200`)
- Telefone normalizado para E.164 BR (`+55...`)
- `mensagem` global pode ser sobrescrita por item
- Cada item vira job na fila `OUTBOUND_RESPONSES`

### Resposta

```json
{
  "accepted": true,
  "total": 2,
  "enqueued": 2,
  "failed": 0,
  "correlationId": "manual-mbq6-123abc",
  "results": [
    {
      "index": 0,
      "leadId": "5511999998888",
      "to": "+5511999998888",
      "status": "enqueued",
      "jobId": "123"
    }
  ]
}
```

## 2) Contrato versionado

- Metodo: `GET`
- Rota: `/api/prospeccao/contract`
- Retorno: objeto JSON com versao e formatos esperados

## 3) Importacao CSV (server-side)

- Metodo: `POST`
- Rota: `/api/prospeccao/importar-leads`
- Auth: header `x-internal-api-key` quando `INTERNAL_API_KEY` estiver configurada

### Payload

```json
{
  "clienteId": "cliente-123",
  "origem": "Importacao CSV",
  "itens": [
    {
      "nome": "Maria",
      "telefone": "11988887777",
      "email": "maria@empresa.com",
      "metadata": { "source": "lovable" }
    }
  ]
}
```

### Resposta

```json
{
  "accepted": true,
  "total": 1,
  "imported": 1,
  "duplicatesInFile": 0,
  "duplicatesInDb": 0,
  "invalid": 0,
  "correlationId": "csv-mbq6-123abc",
  "results": [
    {
      "index": 0,
      "status": "imported",
      "leadId": "5511988887777",
      "to": "+5511988887777"
    }
  ]
}
```

## 4) Pre-checagem de duplicatas

- Metodo: `POST`
- Rota: `/api/prospeccao/check-duplicados`
- Auth: header `x-internal-api-key` quando `INTERNAL_API_KEY` estiver configurada

### Payload

```json
{
  "telefones": ["11999998888", "+5511988887777"]
}
```

### Resposta

```json
{
  "total": 2,
  "duplicates": [
    {
      "telefoneOriginal": "11999998888",
      "telefoneE164": "+5511999998888",
      "leadId": "5511999998888",
      "exists": true
    }
  ]
}
```

## Variaveis de ambiente

- `INTERNAL_API_KEY` (recomendado em producao)
- `MANUAL_DISPATCH_MAX_BATCH` (opcional, default 200)
- `CSV_IMPORT_MAX_BATCH` (opcional, default 2000)
- `DEFAULT_CLIENTE_ID` (fallback de cliente)
