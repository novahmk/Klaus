# Componente 5: Geração de Resposta (Fallback IA)

## Visão Geral

O **Componente 5** é a rede de segurança cognitiva do Klaus V2. É acionado
automaticamente sempre que o score de confiança do **Componente 4 (Ranking)** for
inferior a **0.6** — situações de objeções altamente específicas, nuances técnicas
complexas ou perfis de lead que exigem personalização que modelos estáticos não
suprem.

Sintetiza a **base de conhecimento do cliente**, o **histórico recente** da conversa e o
**perfil do lead** (cargo e nicho) para formular uma réplica única, persuasiva e
tecnicamente precisa, usando **GPT-4** como motor de inferência.

> **Estado atual:** A integração com OpenAI/PostgreSQL real está pendente. O código
> segue a especificação literal. Os testes cobrem validação, montagem de prompt e o
> fluxo de `executar()` com stubs de OpenAI e Redis (independente de banco).

## Arquitetura

```
[ENTRADA] Objeção + Contexto do Lead + Base de Conhecimento
   ↓ Analisador de Contexto
   ↓ Construtor de Prompt (PromptBuilder)
   ↓ Gerador GPT-4 (OpenAI)
   ↓ Validador de Qualidade (ValidadorResposta)
   ↓ Cache Redis
   ↓ Registrador (PostgreSQL - analytics)
[SAÍDA] Resposta Gerada + Score de Confiança
```

## Estrutura de Pastas

```
src/components/5-geracao-resposta/
├── types.ts            # TipoObjecao, ContextoLead, GeracaoInput/Output
├── constants.ts        # CRITERIOS_VALIDACAO, INSTRUCOES_TOM
├── prompts.ts          # PromptBuilder (montagem + tom por cargo)
├── validator.ts        # ValidadorResposta (score 0-100)
├── component.ts        # ComponenteGeracao (classe principal)
├── index.ts            # Exportações públicas
├── exemplo.ts          # Exemplo de uso
├── component.test.ts   # Testes
└── README.md           # Esta documentação
```

## Tom por Cargo

| Cargo (contém) | Tom |
|---|---|
| `ceo`, `diretor` | Executivo (ROI, visão estratégica) |
| `eng`, `cto` | Técnico (especificações, integração) |
| outros | Operacional (facilidade de uso, dia a dia) |

## Validador de Qualidade

O `ValidadorResposta.validar` parte de 100 e aplica penalidades:

| Regra | Penalidade |
|---|---|
| Resposta com menos de 150 caracteres | -30 |
| Ausência de `?` (falta de CTA) | -10 |
| Contém "infelizmente" (tom negativo) | -20 |

O score final é dividido por 100 para gerar a `confianca` (0-1). Pela spec, o limiar
de aprovação é `MIN_SCORE = 70` (`CRITERIOS_VALIDACAO`).

## Schema PostgreSQL

```sql
CREATE TABLE respostas_geradas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL,
  lead_id UUID NOT NULL,
  objecao TEXT NOT NULL,
  resposta_gerada TEXT NOT NULL,
  tipo_objecao VARCHAR(20),
  cargo_lead VARCHAR(100),
  confianca DECIMAL(3,2),
  resultado BOOLEAN,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE historico_geracao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_objecao VARCHAR(20),
  numero_geracoes INT DEFAULT 0,
  taxa_sucesso DECIMAL(5,4),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Uso

```typescript
import { OpenAI } from 'openai';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { ComponenteGeracao } from './components/5-geracao-resposta';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const redis = new Redis(process.env.REDIS_URL);

const componente = new ComponenteGeracao(openai, pool, redis);

const resultado = await componente.executar({
  clienteId: '7f8e9a...',
  leadId: '1a2b3c...',
  objecao: 'Achei o valor acima do orçamento.',
  tipoObjecao: 'PRECO',
  contextoLead: { cargo: 'Diretor Clínico', empresa: 'X', nicho: 'saude', estagio: 'em_conversa' },
  baseConhecimento: { diferenciais: ['ROI em 3 meses'] },
  historico: [{ remetente: 'lead', texto: 'Está caro.' }]
});

console.log(resultado.resposta, resultado.confianca);
```

## Fluxo de Funcionamento

1. **Trigger**: o Componente 4 falha em encontrar resposta com score > 0.6.
2. **Enriquecimento**: metadados do lead são buscados no banco.
3. **Geração**: o GPT-4 processa o prompt com a base de conhecimento injetada.
4. **Crítica**: o validador pontua a resposta; se score < 70, retry automático.
5. **Entrega**: a resposta é enviada e armazenada para análise de conversão.

## Tratamento de Erros

Em caso de falha na API da OpenAI ou timeout, o sistema prevê um **Circuit Breaker**
que reverte para a resposta genérica de maior score do banco, garantindo que o lead
nunca fique sem resposta.

> O loop de retry (score<70) e o circuit breaker são descritos na especificação como
> comportamento previsto; o `executar()` atual segue o skeleton literal e o wiring
> completo será concluído junto à integração do banco/OpenAI.

## Métricas (KPIs)

- **Taxa de Sucesso**: % de leads que avançam após resposta gerada (Meta: > 70%).
- **Latência de Geração**: tempo entre falha do ranking e entrega (Meta: < 5s).
- **Custo por Inferência**: monitoramento de tokens GPT-4.

## Testes

```bash
NODE_ENV=test npm run test -- --run src/components/5-geracao-resposta
```

Cobertura atual:
- `ValidadorResposta.validar`: penalidades e piso de score
- `PromptBuilder`: tom por cargo e inclusão de contexto/objeção
- `ComponenteGeracao.executar`: geração via stub GPT, cache hit/miss, conteúdo nulo

## Próximos Passos

1. ✅ Componente 1: Detecção de Intenção
2. ✅ Componente 2: Geração de Perguntas
3. ✅ Componente 3: Busca no Banco de Dados
4. ✅ Componente 4: Ranking de Objeções Adaptativo
5. ✅ Componente 5: Geração de Resposta (Fallback IA)
6. ⏳ Componente 6: Qualificação
7. ⏳ Componente 7: Orquestração
8. ⏳ Componente 8: Sistema de Filas
