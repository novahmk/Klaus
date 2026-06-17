# Componente 4: Ranking de Objeções Adaptativo

## Visão Geral

O **Componente 4** é o núcleo decisório do Klaus V2. Atua como filtro de
inteligência que seleciona a abordagem mais eficaz para cada interação com o lead.
É **adaptativo**: aprende com o sucesso e o fracasso de interações passadas para
otimizar a conversão futura.

Opera em modelo híbrido entre **perguntas genéricas** (por nicho: Saúde, Estética,
Educação) e **perguntas personalizadas** (criadas pelo cliente no dashboard). Se uma
pergunta personalizada tiver desempenho superior ou maior relevância contextual,
ela é priorizada.

> **Estado atual:** A integração com o banco de dados (PostgreSQL/pgvector) está
> pendente. O código segue a especificação literal. A busca real (`QUERIES` via
> `pool.query`) aguarda a integração do banco; os testes cobrem a lógica de ranking,
> contexto, seleção e cache (independente de banco).

## Estrutura de Pastas

```
src/components/4-ranking-objecoes/
├── types.ts            # Tipos (Intencao, Pergunta, RankingInput/Output)
├── constants.ts        # PESOS_RANKING e LIMITES_BUSCA
├── queries.ts          # SQL (perguntas do cliente, efetividade) + índices
├── adapter.ts          # AdaptadorContexto (cargo × dificuldade)
├── ranker.ts           # RankerPerguntas (score ponderado)
├── cache.ts            # CacheRanking (ioredis)
├── component.ts        # ComponenteRanking (classe principal)
├── index.ts            # Exportações públicas
├── exemplo.ts          # Exemplo de uso
├── component.test.ts   # Testes
└── README.md           # Esta documentação
```

## Algoritmo de Ranking

O score é uma média ponderada:

$$Score = (R \times 0.4) + (E \times 0.3) + (C \times 0.2) + (Rec \times 0.1)$$

| Variável | Descrição |
|---|---|
| **Relevância (R)** | Similaridade de cosseno entre embedding da intenção do lead e da pergunta |
| **Efetividade (E)** | Razão sucessos/total de usos da pergunta para aquele cliente |
| **Contexto (C)** | Adequação entre perfil do lead (cargo/estágio) e metadados da pergunta |
| **Recência (Rec)** | Inversamente proporcional ao número de usos na mesma conversa (evita loops) |

```typescript
RankerPerguntas.calcularScoreFinal(relevancia, efetividade, contexto, recencia);
```

## Entrada e Saída

### `RankingInput`
```typescript
{
  clienteId: string;
  leadId: string;
  intencao: Intencao;
  contextoLead: { nicho: string; cargo: string; estagio: string };
  perguntasCandidatas: Pergunta[];
}
```

### `RankingOutput`
```typescript
{
  perguntaSelecionada: Pergunta;
  score: number;
  motivo: string;
}
```

## Schema PostgreSQL

```sql
CREATE TABLE perguntas_genericas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nicho VARCHAR(50) NOT NULL,
  tema VARCHAR(100),
  texto TEXT NOT NULL,
  tipo VARCHAR(20) CHECK (tipo IN ('aberta', 'fechada', 'escala')),
  dificuldade VARCHAR(20) DEFAULT 'media',
  embedding vector(1536),
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE perguntas_personalizadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL,
  nicho VARCHAR(50),
  tema VARCHAR(100),
  texto TEXT NOT NULL,
  tipo VARCHAR(20),
  dificuldade VARCHAR(20),
  embedding vector(1536),
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE historico_efetividade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pergunta_id UUID NOT NULL,
  cliente_id UUID NOT NULL,
  tipo_pergunta VARCHAR(20) NOT NULL,
  resultado VARCHAR(20) CHECK (resultado IN ('sucesso', 'falha')),
  taxa_conversao_incremental NUMERIC(5,4),
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE configuracao_cliente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID UNIQUE NOT NULL,
  nicho VARCHAR(50) NOT NULL,
  usar_genericas BOOLEAN DEFAULT TRUE,
  usar_personalizadas BOOLEAN DEFAULT TRUE,
  preferencia_tom VARCHAR(30) DEFAULT 'profissional',
  preferencia_dificuldade VARCHAR(20) DEFAULT 'media',
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

Os índices recomendados estão em `INDICES_RECOMENDADOS` (queries.ts).

## Uso

```typescript
import { Pool } from 'pg';
import Redis from 'ioredis';
import { ComponenteRanking } from './components/4-ranking-objecoes';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const redis = new Redis(process.env.REDIS_URL);
const ranking = new ComponenteRanking(pool, redis);

const resultado = await ranking.executar({
  clienteId: '7f8e9a...',
  leadId: '1a2b3c...',
  intencao: 'QUER_MAIS_INFO',
  contextoLead: { nicho: 'saude', cargo: 'Diretor Clínico', estagio: 'em_conversa' },
  perguntasCandidatas: [/* perguntas do banco */]
});

console.log(`Pergunta Selecionada: ${resultado.perguntaSelecionada.texto}`);
```

## Integração com Outros Componentes

- **Componente 1**: fornece o vetor de intenção (base do cálculo de Relevância).
- **Componente 2**: perguntas geradas via LLM entram na lista de candidatas.
- **Componente 3**: fornece dados do banco e histórico do lead (cálculo de Contexto).
- **Orquestrador (Comp. 7)**: invoca `.executar()` e despacha a pergunta selecionada.

## Testes

```bash
NODE_ENV=test npm run test -- --run src/components/4-ranking-objecoes
```

Cobertura atual (independente de banco):
- `RankerPerguntas.calcularScoreFinal`: pesos e média ponderada
- `AdaptadorContexto.calcularFatorContexto`: alinhamento cargo × dificuldade
- `ComponenteRanking.executar`: seleção da vencedora e scoring
- `CacheRanking`: prefixo de chave, TTL de 3600s, get/set

> A busca real no PostgreSQL (`QUERIES`) e o cálculo de efetividade com dados reais
> aguardam a integração com o banco de dados.

## Próximos Passos

1. ✅ Componente 1: Detecção de Intenção
2. ✅ Componente 2: Geração de Perguntas
3. ✅ Componente 3: Busca no Banco de Dados
4. ✅ Componente 4: Ranking de Objeções Adaptativo
5. ⏳ Componente 5: Geração de Resposta
6. ⏳ Componente 6: Qualificação
7. ⏳ Componente 7: Orquestração
8. ⏳ Componente 8: Sistema de Filas
