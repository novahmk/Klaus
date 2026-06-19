# Integracao OpenAI

Esta pasta centraliza configuracao e cliente OpenAI usados no Klaus V2.

## Variaveis de ambiente

- OPENAI_API_KEY: chave da API (obrigatoria para chamadas reais)
- OPENAI_MODEL_EMBEDDING: modelo de embedding (default: text-embedding-3-small)
- OPENAI_MODEL_CHAT: modelo de chat (default: gpt-4o-mini)
- OPENAI_TEMPERATURE: temperatura para geracao (default: 0.7)

## Uso basico

```ts
import { OpenAIClient } from './client';

const client = new OpenAIClient();
const embeddings = await client.embeddings({ input: 'texto para embedding' });
```

Se OPENAI_API_KEY nao estiver configurada, o construtor de OpenAIClient lanca erro explicito.
