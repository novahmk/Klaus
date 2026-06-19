# Klaus V2

## Visão Geral

Klaus V2 é um **SDR (Sales Development Representative) baseado em Inteligência Artificial**.

Sua função é substituir a primeira camada de atendimento comercial, conduzindo leads através de uma conversa natural até que estejam qualificados para serem transferidos para um vendedor humano.

### Objetivo Principal

Transformar conversas em oportunidades comerciais qualificadas.

---

## Componentes

O Klaus V2 é dividido em **8 componentes independentes** com responsabilidades únicas:

### ✅ Componente 1: Detecção de Intenção (CONCLUÍDO)
Identifica o que o lead deseja através de análise por GPT, fallback por palavras-chave e cache Redis.

**Status**: Pronto para Produção ✅
- Tipagem TypeScript completa
- Logs estruturados com Pino
- Tratamento de erro robusto
- Testes unitários + integração
- Cache Redis inteligente
- 6 intenções: QUER_AGENDAR, QUER_MAIS_INFO, TEM_OBJECAO, DEMONSTRA_INTERESSE, NAO_INTERESSADO, NAO_RESPONDEU

[Ver documentação](src/components/1-deteccao-intencao/README.md)

### 📋 Componente 2: Geração de Perguntas
Responsável por conduzir a conversa (Necessidade → Objeção → Confirmação)

### 📊 Componente 3: Busca de Conhecimento
Recupera respostas aprovadas (Base do cliente → Objeções personalizadas → Base genérica)

### 🎯 Componente 4: Ranking Adaptativo
Escolhe a melhor resposta disponível (relevância, efetividade, contexto, recência)

### 🧠 Componente 5: Geração de Respostas
GPT com regras de segurança (apenas quando banco não possui resposta)

### ⭐ Componente 6: Qualificação
Gera score do lead (1-10) e determina handoff

### 🎪 Componente 7: Orquestrador
Coordena todos os componentes (sem desvios)

### 📦 Componente 8: Sistema de Filas
Escalabilidade com BullMQ (processamento, concorrência, retries, prioridades)

---

## Stack Obrigatória

- **Backend**: TypeScript + Node.js
- **Banco**: PostgreSQL + pgvector
- **Cache**: Redis
- **Filas**: BullMQ
- **IA**: OpenAI GPT-4 Turbo + text-embedding-3-small

---

## Quick Start

### Instalação

```bash
# Clonar repositório
git clone https://github.com/novahmk/Klaus.git
cd Klaus

# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env
```

### Desenvolvimento

```bash
# Executar em desenvolvimento
npm run dev

# Executar testes
npm run test

# Cobertura de testes
npm run test:coverage

# Build
npm build

# Linter
npm run lint

# Type check
npm run type-check
```

### Deploy no Railway

O projeto já está compatível com Railway usando Dockerfile.

1. Crie um novo projeto no Railway e conecte este repositório.
2. No serviço da aplicação, use o Dockerfile da raiz do projeto.
3. Provisione PostgreSQL e Redis no mesmo projeto Railway.
4. Configure as variáveis de ambiente abaixo no serviço da aplicação.
5. Configure healthcheck em `/health`.
6. Faça deploy e valide os endpoints `/` e `/health`.

Variáveis mínimas para produção:

```bash
PORT=8080
NODE_ENV=production
PROCESSING_MODE=queue

OPENAI_API_KEY=<secret>
OPENAI_MODEL_EMBEDDING=text-embedding-3-small
OPENAI_MODEL_CHAT=gpt-4o-mini
OPENAI_TEMPERATURE=0.7

DATABASE_URL=<provisionado pelo Railway>
REDIS_URL=<provisionado pelo Railway>

WASENDERAPI_TOKEN=<secret>
WASENDERAPI_BASE_URL=https://www.wasenderapi.com/api
WASENDERAPI_WEBHOOK_SECRET=<secret>
DEFAULT_CLIENTE_ID=default
LOG_LEVEL=info
```

Após o primeiro deploy, execute migrations no ambiente:

```bash
npm run migrate:prod
```

Checklist operacional rápido:

```bash
# build local (opcional, antes do push)
npm run build

# checagens mínimas
npm run type-check
npx vitest run src/integrations/openai/client.test.ts
```

Runbook detalhado: ver `RAILWAY_DEPLOY.md`.

### Uso Básico (Componente 1)

```typescript
import { DetectorIntencao } from './components/1-deteccao-intencao';

const detector = new DetectorIntencao({
  enableFallback: true,
  enableGpt: true,
  openaiApiKey: process.env.OPENAI_API_KEY,
  enableCache: true,
  redisUrl: process.env.REDIS_URL
});

const resultado = await detector.detectar({
  mensagem: 'Gostaria de agendar uma reunião',
  contexto: { empresa: 'Tech Corp' }
});

console.log(resultado);
// {
//   intencao: 'QUER_AGENDAR',
//   confianca: 95,
//   motivo: 'Lead explicitamente pediu para agendar reunião',
//   timestamp: 2026-06-17T...,
//   origem: 'gpt'
// }
```

---

## Arquitetura

```
src/
├── components/
│   ├── 1-deteccao-intencao/          ✅ CONCLUÍDO
│   │   ├── types.ts
│   │   ├── constants.ts
│   │   ├── prompts.ts
│   │   ├── validator.ts
│   │   ├── fallback.ts
│   │   ├── cache.ts
│   │   ├── detector.ts
│   │   ├── detector.test.ts
│   │   ├── cache.test.ts
│   │   ├── exemplo.ts
│   │   ├── index.ts
│   │   └── README.md
│   ├── 2-geracao-perguntas/          📋 PRÓXIMO
│   ├── shared/                        (Módulos compartilhados)
│   │   └── logger.ts
│   └── ...
├── index.ts
└── ...
```

---

## Regras Absolutas

🚫 **Nunca**:
- Remover cache
- Remover fallback
- Remover logs
- Remover validações
- Alterar contratos públicos
- Alterar enums globais
- Criar dependências circulares
- Misturar responsabilidades entre componentes

✅ **Sempre**:
- Tipagem TypeScript completa
- Logs estruturados
- Tratamento de erro
- Testes unitários + integração
- Cache quando necessário
- Documentação atualizada

---

## Padrão de Qualidade

Cada componente entregue **DEVE** conter:

1. ✅ Tipagem completa
2. ✅ Logs estruturados
3. ✅ Tratamento de erro
4. ✅ Testes unitários
5. ✅ Testes de integração
6. ✅ Cache quando necessário
7. ✅ Documentação

**Nenhum componente é considerado concluído sem esses requisitos.**

---

## Fluxo Oficial

```
Mensagem recebida
    ↓
Detecção de intenção (Componente 1) ✅
    ↓
Decisão do fluxo
    ↓
Geração de pergunta ou busca (Componentes 2, 3)
    ↓
Ranking (Componente 4)
    ↓
Resposta (Componente 5 ou base)
    ↓
Qualificação (Componente 6)
    ↓
Atualização do histórico
    ↓
Próxima interação
```

---

## Definição de Sucesso

O Klaus será considerado completo quando for capaz de:

1. Receber uma mensagem
2. Entender a intenção ✅ (Componente 1)
3. Conduzir uma conversa adaptativa
4. Tratar objeções
5. Aprender com histórico
6. Qualificar o lead
7. Encaminhar leads prontos para venda
8. Operar de forma escalável em produção

---

## Testes

```bash
# Todos os testes
npm run test

# Com cobertura
npm run test:coverage

# Watch mode
npm run test -- --watch
```

**Cobertura esperada**: >= 80%

---

## Documentação

- [Componente 1: Detecção de Intenção](src/components/1-deteccao-intencao/README.md)
- [Especificação Técnica](SPECIFICATION.md) *(em desenvolvimento)*
- [API Reference](docs/API.md) *(em desenvolvimento)*

---

## Variáveis de Ambiente

```bash
# .env
OPENAI_API_KEY=sk_...
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://...
LOG_LEVEL=info
NODE_ENV=development
```

---

## Performance

- **Cache hit**: < 5ms
- **Fallback**: < 50ms
- **GPT**: 500-2000ms

---

## Logs

Klaus V2 usa **Pino** para logs estruturados:

```
[info] Klaus V2 iniciado
[info] Cache Redis conectado com sucesso
[debug] Enviando requisição para GPT
[info] Intenção detectada | tempo: 150ms | origem: gpt | confianca: 95
```

---

## Contribuindo

Para contribuir com um novo componente:

1. Respeite a especificação global
2. Siga o padrão de qualidade
3. Implemente todos os requisitos
4. Adicione testes abrangentes
5. Documente completamente

---

## Licença

MIT

---

## Status

| Componente | Status | Progresso |
|-----------|--------|-----------|
| 1 - Detecção de Intenção | ✅ Concluído | 100% |
| 2 - Geração de Perguntas | 📋 Planejado | 0% |
| 3 - Busca de Conhecimento | 📋 Planejado | 0% |
| 4 - Ranking Adaptativo | 📋 Planejado | 0% |
| 5 - Geração de Respostas | 📋 Planejado | 0% |
| 6 - Qualificação | 📋 Planejado | 0% |
| 7 - Orquestrador | 📋 Planejado | 0% |
| 8 - Sistema de Filas | 📋 Planejado | 0% |

---

Criado com ❤️ para transformar vendas em conversas