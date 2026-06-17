# Componente 3: Busca no Banco de Dados

## Visão Geral

O **Componente 3** é o motor de recuperação de informação do Klaus V2. Atua como
camada de inteligência entre a detecção de intenção (Componente 1) e a geração de
resposta, garantindo que o SDR IA utilize informações precisas da base de
conhecimento do cliente ou respostas validadas para objeções conhecidas.

Utiliza uma abordagem **híbrida**: prioriza busca por palavra-chave (baixo custo) no
PostgreSQL e recorre à busca semântica via vetores (pgvector) quando a similaridade
textual não é suficiente.

> **Estado atual:** A integração com o banco de dados (PostgreSQL/pgvector) está
> pendente. O código segue a especificação literal e está pronto para conectar ao
> banco assim que a infraestrutura estiver disponível. Os testes cobrem a lógica
> independente de banco (validações, similaridade de embeddings e cache).

## Fluxo de Funcionamento

1. Recebimento da intenção detectada e contexto do lead.
2. Verificação de cache em Redis para respostas recorrentes.
3. Busca por palavra-chave no PostgreSQL (Base de Conhecimento e Objeções).
4. Busca semântica via embeddings caso o limiar de relevância não seja atingido.
5. Validação e ranking dos resultados encontrados.
6. Registro de uso para análise de efetividade e melhoria contínua.

## Estrutura de Pastas

```
src/components/3-busca-banco/
├── types.ts            # Interfaces e tipos
├── constants.ts        # Limites, pesos, TTLs e mapeamento intenção→tipo
├── queries.ts          # SQL (palavra-chave, semântica, analytics) + índices
├── embeddings.ts       # Geração de embeddings e similaridade de cosseno
├── cache.ts            # Cache Redis (ioredis)
├── validators.ts       # Validação e scoring de resultados
├── searcher.ts         # Classe principal (BuscadorBanco)
├── index.ts            # Exportações públicas
├── exemplo.ts          # Exemplo de uso
├── searcher.test.ts    # Testes
└── README.md           # Esta documentação
```

## Dependências

```json
{
  "dependencies": {
    "pg": "^8.10.0",
    "ioredis": "^5.3.2",
    "openai": "^4.20.0"
  }
}
```

Requisitos de infraestrutura:
- **PostgreSQL** (Railway) com extensão **pgvector**
- **Redis** para cache
- **OpenAI API** para geração de embeddings

## Entrada e Saída

### `BuscaBancoInput`
```typescript
{
  intencao: Intencao;        // Vindo do Componente 1
  objecao?: string;          // Texto da objeção (quando aplicável)
  contexto: {
    tema: string;
    historico: string;
    numeroMensagens: number;
    tempoNoFunil: number;
  };
  clienteId: string;
  leadId: string;
}
```

### `BuscaBancoOutput`
```typescript
{
  respostas: RespostaEncontrada[];  // Ordenadas por score
  totalEncontrado: number;
  tempoExecucao: number;            // ms
  origem: 'banco' | 'cache';
  timestamp: Date;
}
```

## Mapeamento Intenção → Tipo de Resposta

| Intenção | Tipos pesquisados |
|---|---|
| `QUER_AGENDAR` | base_conhecimento, objecao_personalizada |
| `QUER_MAIS_INFO` | base_conhecimento |
| `TEM_OBJECAO` | objecao_padrao, objecao_personalizada |
| `DEMONSTRA_INTERESSE` | base_conhecimento |
| `NAO_RESPONDEU` | (nenhum) |
| `NAO_INTERESSADO` | objecao_padrao |

## Limites e Scoring

```typescript
LIMITES_BUSCA = {
  MAX_RESULTADOS: 5,
  MIN_RELEVANCIA: 0.6,
  MIN_EFETIVIDADE: 0.3,
  TIMEOUT_BUSCA: 5000
};

PESOS_SCORING = { RELEVANCIA: 0.5, EFETIVIDADE: 0.3, RECENCIA: 0.2 };

CACHE_TTL = {
  BUSCA_PADRAO: 24h,
  BUSCA_PERSONALIZADA: 7 dias
};
```

O score final usado no ranking combina relevância e efetividade:
`score = relevancia * 0.5 + efetividade * 0.5`.

## Uso

```typescript
import { Pool } from 'pg';
import Redis from 'ioredis';
import { OpenAIClient } from '../../integrations/openai/client';
import { BuscadorBanco } from './components/3-busca-banco';
import { Intencao } from './components/1-deteccao-intencao/types';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const redis = new Redis(process.env.REDIS_URL);
const openaiClient = new OpenAIClient(process.env.OPENAI_API_KEY);

const buscador = new BuscadorBanco(pool, redis, openaiClient);

const resultado = await buscador.buscar({
  intencao: Intencao.QUER_MAIS_INFO,
  objecao: 'Preço',
  contexto: {
    tema: 'Transplante capilar',
    historico: 'Lead: Qual é o preço?',
    numeroMensagens: 2,
    tempoNoFunil: 1
  },
  clienteId: 'cliente-123',
  leadId: 'lead-456'
});

console.log(resultado.respostas[0]?.conteudo);
```

### Registro de uso (analytics)

```typescript
await buscador.registrarUso(
  'cliente-123',
  'lead-456',
  resultado.respostas[0].id,
  resultado.respostas[0].tipo,
  true // resultado positivo → incrementa efetividade da objeção personalizada
);
```

## Setup do Banco de Dados

Execute uma única vez no PostgreSQL:

```sql
-- Extensão pgvector (busca semântica)
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS base_conhecimento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL,
  tema VARCHAR(255) NOT NULL,
  descricao TEXT NOT NULL,
  beneficios TEXT[] DEFAULT ARRAY[]::TEXT[],
  preco VARCHAR(100),
  diferenciais TEXT[] DEFAULT ARRAY[]::TEXT[],
  casos_de_uso TEXT[] DEFAULT ARRAY[]::TEXT[],
  embedding vector(1536),
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS objecoes_padrao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objecao VARCHAR(255) NOT NULL,
  palavras_chave TEXT[] DEFAULT ARRAY[]::TEXT[],
  resposta TEXT NOT NULL,
  taxa_efetividade FLOAT DEFAULT 0.5,
  embedding vector(1536),
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS objecoes_personalizadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL,
  objecao VARCHAR(255) NOT NULL,
  palavras_chave TEXT[] DEFAULT ARRAY[]::TEXT[],
  resposta TEXT NOT NULL,
  taxa_efetividade FLOAT DEFAULT 0.5,
  embedding vector(1536),
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS uso_respostas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL,
  lead_id UUID NOT NULL,
  resposta_id UUID NOT NULL,
  tipo_resposta VARCHAR(50),
  resultado BOOLEAN,
  criado_em TIMESTAMP DEFAULT NOW()
);
```

Os índices recomendados estão disponíveis em `INDICES_RECOMENDADOS` (queries.ts).

## Integração com o Orquestrador (Componente 7)

```typescript
const buscaResultado = await this.buscador.buscar({
  intencao: intencao.intencao,
  objecao: this.extrairObjecao(mensagem),
  contexto: {
    tema: mensagem.tema,
    historico: this.formatarHistorico(mensagem.historico),
    numeroMensagens: mensagem.historico.length,
    tempoNoFunil: this.calcularTempoNoFunil(mensagem)
  },
  clienteId: mensagem.clienteId,
  leadId: mensagem.leadId
});

if (buscaResultado.totalEncontrado > 0) {
  const resposta = buscaResultado.respostas[0];
  await this.buscador.registrarUso(
    mensagem.clienteId,
    mensagem.leadId,
    resposta.id,
    resposta.tipo,
    true
  );
  return { tipo: 'resposta', conteudo: resposta.conteudo, origem: 'banco' };
}
```

## Testes

```bash
NODE_ENV=test npm run test -- --run src/components/3-busca-banco
```

Cobertura atual (independente de banco):
- `ValidadorResultados`: validação, filtragem, limite, scoring
- `GeradorEmbeddings.calcularSimilaridade`: similaridade de cosseno
- `CacheBusca`: chaves, TTL padrão vs. personalizado, limpar e invalidar
- `MAPEAMENTO_INTENCAO_TIPO`: cobertura das intenções

> Os testes do fluxo completo de `BuscadorBanco.buscar` (que dependem de
> `pool.query`) aguardam a integração com o banco de dados.

## Próximos Passos

1. ✅ Componente 1: Detecção de Intenção
2. ✅ Componente 2: Geração de Perguntas
3. ✅ Componente 3: Busca no Banco de Dados
4. ⏳ Componente 4: Ranking de Objeções
5. ⏳ Componente 5: Geração de Resposta
6. ⏳ Componente 6: Qualificação
7. ⏳ Componente 7: Orquestração
8. ⏳ Componente 8: Sistema de Filas
