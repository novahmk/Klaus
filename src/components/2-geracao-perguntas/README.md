# Componente 2: Gerador de Perguntas Adaptativas

## Visão Geral

O **Componente de Geração de Perguntas** é responsável por gerar perguntas adaptativas que conduzem o lead através de 3 camadas do funil de qualificação.

**Entradas**:
- Tema da conversa
- Histórico da conversa
- Intenção detectada (Componente 1)
- ID do cliente
- Perguntas já feitas

**Saídas**:
- Pergunta adaptativa (20-150 caracteres)
- Contexto esperado
- Camada (1, 2 ou 3)
- Origem (GPT ou Template)

## Arquitetura

```
src/components/2-geracao-perguntas/
├── types.ts          # Tipos e interfaces
├── constants.ts      # Templates e configurações
├── prompts.ts        # Prompts para GPT
├── validators.ts     # Validação rigorosa
├── cache.ts          # Gerenciamento Redis
├── generator.ts      # Lógica principal
├── index.ts          # Exportações públicas
├── generator.test.ts # Testes unitários
├── cache.test.ts     # Testes de cache
├── exemplo.ts        # Exemplos de uso
└── README.md         # Esta documentação
```

## As 3 Camadas

### Camada 1: NECESSIDADE
**Objetivo**: Descobrir o que o lead realmente precisa

Exemplos de perguntas:
- "Qual é o seu maior desafio?"
- "Como você está lidando com isso hoje?"
- "Qual seria o impacto se conseguisse resolver?"

### Camada 2: OBJEÇÃO
**Objetivo**: Entender as objeções e preocupações

Exemplos de perguntas:
- "O que seria necessário para mudar sua solução atual?"
- "Quais são suas preocupações principais?"
- "Qual é o seu orçamento disponível?"

### Camada 3: CONFIRMAÇÃO
**Objetivo**: Confirmar entendimento e próximos passos

Exemplos de perguntas:
- "Se eu entendi bem, o problema é...?"
- "Faz sentido marcarmos uma reunião?"
- "Qual seria o próximo passo ideal?"

## Algoritmo de Determinação de Camada

```typescript
function determinarCamada(numeroPerguntasFeitas: number): 1 | 2 | 3 {
  if (numeroPerguntasFeitas === 0) return 1;  // Primeira pergunta
  if (numeroPerguntasFeitas === 1) return 2;  // Segunda pergunta
  return 3;                                    // Terceira+ pergunta
}
```

## Validações Rigorosas

### 1. Tamanho (20-150 caracteres)
```typescript
✅ "Qual é seu maior desafio?"  // 33 caracteres - OK
❌ "Oi?"                        // 3 caracteres - MUITO CURTA
❌ "Como você faria para resolver o problema mais complexo..." (repetido)  // MUITO LONGA
```

### 2. Deve ser Pergunta Aberta
```typescript
✅ "Qual é seu desafio?"        // Aberta
✅ "Como você está lidando?"    // Aberta
❌ "Você prefere essa solução?" // Fechada (sim/não)
❌ "É verdade que você quer?"   // Fechada
```

### 3. Sempre Terminar com "?"
```typescript
✅ "Qual é seu desafio?"
❌ "Qual é seu desafio"
```

### 4. Sem Placeholders
```typescript
✅ "Qual é seu maior desafio?"
❌ "Qual é o desafio da {EMPRESA}?"
❌ "Qual é seu EMAIL?"
```

### 5. Sem Repetição (Máximo 70% similaridade)
```typescript
Histórico: ["Qual é seu maior desafio?"]
✅ "Como você está lidando com isso?" // Diferente
❌ "Qual é o seu maior desafio agora?" // Muito similar
```

### 6. Sem Caracteres Inválidos
```typescript
✅ "Qual é seu maior desafio?"  // Apenas letras, acentos, pontuação
❌ "Qual é @#$% seu desafio?"   // Caracteres inválidos
```

## Fluxo de Geração

```
Entrada validada
        ↓
Determinar camada (0→1, 1→2, 2+→3)
        ↓
Verificar cache (Redis)
    ↓ (hit)           ↓ (miss)
  Return         Tentar GPT (se habilitado)
               ↓ (sucesso)    ↓ (falha)
              Return      Usar fallback
                ↓         (templates)
              Return        ↓
                         Return genérico
```

## Métodos de Geração

### 1. Cache Redis (0-5ms)
- Busca pergunta já gerada para tema + camada + cliente
- Retorna instantaneamente
- TTL: 2 horas (configurável)

### 2. GPT (500-2000ms)
- Análise semântica com prompt customizado
- Adapta ao histórico e intenção
- Valida resposta antes de retornar

### 3. Fallback por Template (0-50ms)
- 24 templates pré-definidos (8 por camada)
- Seleciona template adequado por intenção
- Garante resposta válida sempre

## Uso

### Inicialização

```typescript
import { GeradorPerguntas } from './components/2-geracao-perguntas';

const gerador = new GeradorPerguntas({
  enableFallback: true,          // Sempre disponível
  enableGpt: true,               // Opcional
  openaiApiKey: process.env.OPENAI_API_KEY,
  enableCache: true,             // Opcional
  redisUrl: process.env.REDIS_URL,
  maxSimilaridade: 0.7           // Máximo 70%
});
```

### Gerar Pergunta

```typescript
const resultado = await gerador.gerar({
  tema: 'Automação de Vendas',
  historico: [
    {
      papel: 'sistema',
      conteudo: 'Olá! Como posso ajudá-lo?',
      timestamp: new Date()
    },
    {
      papel: 'lead',
      conteudo: 'Oi, preciso de uma solução de vendas',
      timestamp: new Date()
    }
  ],
  intencao: Intencao.QUER_MAIS_INFO,
  clienteId: 'lead-123',
  perguntasJaFeitas: []
});

console.log(resultado);
// {
//   pergunta: "Qual é o seu maior desafio em vendas?",
//   contextoEsperado: "Lead descrevendo pain point",
//   camada: 1,
//   timestamp: 2026-06-17T...,
//   origem: "template"
// }
```

### Sequência de 3 Perguntas

```typescript
// 1ª Pergunta (Necessidade)
const resultado1 = await gerador.gerar({
  tema: 'Vendas',
  historico,
  intencao,
  clienteId,
  perguntasJaFeitas: []  // Nenhuma → Camada 1
});

// 2ª Pergunta (Objeção)
const resultado2 = await gerador.gerar({
  ...input,
  perguntasJaFeitas: [resultado1.pergunta]  // 1 → Camada 2
});

// 3ª Pergunta (Confirmação)
const resultado3 = await gerador.gerar({
  ...input,
  perguntasJaFeitas: [
    resultado1.pergunta,
    resultado2.pergunta
  ]  // 2+ → Camada 3
});
```

## Validações Implementadas

### ValidadorPergunta

```typescript
// Validar pergunta completa
const validacao = ValidadorPergunta.validarCompleto(
  "Qual é seu desafio?",
  ["Pergunta anterior?"]
);

if (!validacao.valido) {
  console.log(validacao.erros);
  // Retorna array de erros encontrados
}
```

### Checklist de Validações

- ✅ Tamanho: 20-150 caracteres
- ✅ Termina com "?"
- ✅ É pergunta aberta
- ✅ Sem placeholders
- ✅ Sem similaridade excessiva
- ✅ Sem caracteres inválidos
- ✅ Entrada válida (tema, histórico)
- ✅ Resultado final válido

## Configuração

```typescript
interface GeradorConfig {
  redisUrl?: string;           // URL do Redis
  openaiApiKey?: string;       // Chave API OpenAI
  enableCache?: boolean;       // Ativar cache (padrão: true)
  enableFallback?: boolean;    // Ativar fallback (padrão: true)
  enableGpt?: boolean;         // Ativar GPT (padrão: true)
  cacheExpireSec?: number;     // TTL do cache (padrão: 7200)
  maxSimilaridade?: number;    // Máximo de similaridade (padrão: 0.7)
}
```

## Testes

```bash
# Todos os testes
npm run test

# Com cobertura
npm run test:coverage

# Especifico deste componente
NODE_ENV=test npm run test -- generator.test.ts
```

**Cobertura**:
- ✅ 47+ testes unitários
- ✅ Validação de perguntas
- ✅ Determinação de camadas
- ✅ Fluxo completo
- ✅ Casos de borda

## Logs Estruturados

O componente utiliza **Pino** para logs estruturados:

```
[info] Cache Redis conectado com sucesso
[debug] Camada determinada | camada: 2 | numeroPerguntasFeitas: 1
[debug] Enviando requisição para GPT
[info] Pergunta gerada via GPT | tempo: 750ms | origem: gpt
[warn] Resposta GPT inválida | erro: Resposta não contém campos obrigatórios
[debug] Cache hit para pergunta | chave: pergunta:...
[info] Pergunta gerada via template | tempo: 5ms | origem: template
```

## Performance

| Método | Tempo | Origem |
|--------|-------|--------|
| Cache hit | 0-5ms | Redis |
| Fallback | 0-50ms | Template |
| GPT | 500-2000ms | OpenAI |

## Integração com Componente 1

```typescript
// Componente 1 detecta intenção
const deteccao = await detector.detectar({
  mensagem: 'Estou muito interessado!'
});
// → intencao: DEMONSTRA_INTERESSE

// Componente 2 usa intenção para gerar pergunta
const pergunta = await gerador.gerar({
  tema: 'Vendas',
  historico,
  intencao: deteccao.intencao  // ← AQUI
});
```

## Estrutura de Dados

### Input
```typescript
{
  tema: string;                           // "Vendas"
  historico: Mensagem[];                  // Array de mensagens
  intencao: Intencao;                     // QUER_AGENDAR, etc
  clienteId: string;                      // "lead-123"
  baseConhecimento?: Record<string, any>; // Dados extras
  perguntasJaFeitas?: string[];           // Histórico de perguntas
}
```

### Output
```typescript
{
  pergunta: string;                       // "Qual é seu desafio?"
  contextoEsperado: string;               // "Lead descrevendo..."
  camada: 1 | 2 | 3;                      // Qual camada
  timestamp: Date;                        // Quando foi gerado
  origem: 'gpt' | 'template';             // Como foi gerado
}
```

## Segurança

- ✅ Validação rigorosa de entrada
- ✅ Sanitização de respostas do GPT
- ✅ Limite de tamanho de pergunta (150 caracteres)
- ✅ Sem exposição de secrets nos logs
- ✅ Tratamento seguro de falhas

## Próximos Componentes

Este componente alimenta:
- **Componente 3**: Busca de Conhecimento (busca respostas para a pergunta gerada)
- **Componente 4**: Ranking Adaptativo (prioriza entre múltiplas perguntas)
- **Componente 7**: Orquestrador (coordena o fluxo)

## FAQ

**P: Posso adicionar novas camadas?**
R: Não, as 3 camadas são fixas: Necessidade → Objeção → Confirmação

**P: Como adiciono novos templates?**
R: Edite `TEMPLATES_PERGUNTAS` em `constants.ts`

**P: Posso customizar o limite de similaridade?**
R: Sim, via `maxSimilaridade` na config (0-1, default 0.7)

**P: E se quiser diferentes algoritmos de camada?**
R: Modifique `determinarCamada()` em `constants.ts`

**P: Como posso usar sem GPT?**
R: `enableGpt: false` - vai usar fallback por templates

**P: Cache precisa de Redis?**
R: Não, faz fallback para memory se Redis não estiver disponível

## Licença

MIT - Klaus V2
