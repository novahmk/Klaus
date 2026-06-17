# Klaus V2

Klaus V2 is an AI-powered SDR (Sales Development Representative) that replaces the first layer of commercial outreach. It conducts natural, adaptive conversations with leads until they are qualified for hand-off to a human sales representative.

---

## Architecture

The system is composed of 8 independent components coordinated by an orchestrator.

| # | Component | Responsibility |
|---|-----------|---------------|
| 1 | **Intent Detection** | Identifies what the lead wants — returns intent, confidence, and justification |
| 2 | **Question Generation** | Generates the next question across three layers: Need → Objection → Confirmation |
| 3 | **Knowledge Search** | Retrieves approved answers from the knowledge base via pgvector similarity search |
| 4 | **Adaptive Ranking** | Ranks candidate responses by relevance, effectiveness, recency, and context |
| 5 | **Response Generation** | GPT fallback executed only when the knowledge base has no adequate answer |
| 6 | **Qualification** | Produces a lead score (1–10) and determines handoff to sales |
| 7 | **Orchestrator** | Coordinates all components — no flow occurs without passing through here |
| 8 | **Queue System** | BullMQ-powered processing with concurrency, retries, and priorities |

### Conversation flow

```
Message received
  → Intent Detection
  → Question Generation
  → Knowledge Search
  → Adaptive Ranking
  → Response (knowledge base or GPT)
  → Qualification
  → History update
  → Next interaction
```

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Backend | TypeScript · Node.js |
| Database | PostgreSQL |
| Vector search | pgvector (`text-embedding-3-small`) |
| Cache | Redis (ioredis) |
| Queue | BullMQ |
| AI | OpenAI GPT |

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL with the `pgvector` extension
- Redis

### Install

```bash
npm install
```

### Environment variables

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=klaus
POSTGRES_USER=postgres
POSTGRES_PASSWORD=

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

QUALIFICATION_HANDOFF_THRESHOLD=8
```

### Database setup

```bash
psql -d klaus -f src/db/schema.sql
```

### Run

```bash
npm run build
npm run dev
```

### Test

```bash
npm test
npm run test:coverage
```

---

## Project Structure

```
src/
├── components/
│   ├── intent-detection/       # Component 1
│   ├── question-generation/    # Component 2
│   ├── knowledge-search/       # Component 3
│   ├── adaptive-ranking/       # Component 4
│   ├── response-generation/    # Component 5
│   ├── qualification/          # Component 6
│   ├── orchestrator/           # Component 7
│   └── queue-system/           # Component 8
├── config/
├── db/
├── types/
└── utils/
```

---

## Quality Standards

Every component includes:

- Full TypeScript typing
- Structured logs (Winston)
- Error handling with safe fallbacks
- Cache layer (Redis) where applicable
- Unit tests (Jest + ts-jest)
