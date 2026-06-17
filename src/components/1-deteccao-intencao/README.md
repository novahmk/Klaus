# Componente 1: Detecção de Intenção

## Visão Geral

O **Componente de Detecção de Intenção** é responsável por analisar mensagens de leads e identificar suas intenções dentro do fluxo de vendas.

Ele retorna:
- **Intenção**: Uma das 6 intenções possíveis
- **Confiança**: Nível de confiança da análise (0-100)
- **Motivo**: Justificativa da detecção
- **Origem**: Qual método foi usado (GPT, Fallback ou Cache)
- **Timestamp**: Quando foi processado

## Intenções Suportadas

```typescript
enum Intencao {
  QUER_AGENDAR = 'QUER_AGENDAR'           // Lead quer agendar reunião
  QUER_MAIS_INFO = 'QUER_MAIS_INFO'       // Lead quer mais informações
  TEM_OBJECAO = 'TEM_OBJECAO'             // Lead apresenta objeção
  DEMONSTRA_INTERESSE = 'DEMONSTRA_INTERESSE' // Lead demonstra interesse
  NAO_INTERESSADO = 'NAO_INTERESSADO'     // Lead sem interesse
  NAO_RESPONDEU = 'NAO_RESPONDEU'         // Lead não respondeu adequadamente
}
```

## Arquitetura

```
src/components/1-deteccao-intencao/
├── types.ts          # Tipos e interfaces
├── constants.ts      # Palavras-chave, configurações
├── prompts.ts        # Prompts para GPT
├── validator.ts      # Validação de entradas/saídas
├── fallback.ts       # Análise por palavras-chave
├── cache.ts          # Gerenciamento Redis
├── detector.ts       # Lógica principal (orquestrador)
├── index.ts          # Exportações públicas
├── detector.test.ts  # Testes unitários
├── cache.test.ts     # Testes de cache
├── exemplo.ts        # Exemplos de uso
└── README.md         # Esta documentação
```

## Fluxo de Detecção

```
Mensagem recebida
        ↓
Validação de entrada
        ↓
Verificar cache (Redis)
    ↓ (hit)           ↓ (miss)
  Return         Tentar GPT (se habilitado)
               ↓ (sucesso)    ↓ (falha)
              Return      Usar fallback
                         ↓
                      Return NAO_RESPONDEU
```

## Uso

### Inicialização Básica

```typescript
import { DetectorIntencao } from './components/1-deteccao-intencao';

const detector = new DetectorIntencao({
  enableFallback: true,  // Análise por palavras-chave
  enableGpt: false,      // Desabilitado neste exemplo
  enableCache: false     // Desabilitado neste exemplo
});
```

### Detecção Simples

```typescript
const resultado = await detector.detectar({
  mensagem: 'Gostaria de agendar uma reunião'
});

console.log(resultado);
// {
//   intencao: 'QUER_AGENDAR',
//   confianca: 85,
//   motivo: 'Análise por palavras-chave detectou: desejo de agendar',
//   timestamp: 2026-06-17T...,
//   origem: 'fallback'
// }
```

### Com Histórico

```typescript
const resultado = await detector.detectar({
  mensagem: 'Perfeito! Quando podemos conversar?',
  historico: [
    { 
      papel: 'sistema', 
      conteudo: 'Este é nosso novo produto com IA',
      timestamp: new Date()
    },
    { 
      papel: 'lead', 
      conteudo: 'Legal! Pode me explicar mais?',
      timestamp: new Date()
    }
  ]
});
```

### Com Contexto do Lead

```typescript
const resultado = await detector.detectar({
  mensagem: 'Muito caro',
  contexto: {
    leadId: 'lead-123',
    empresa: 'Tech Startup',
    segmento: 'SaaS',
    faseFunil: 'Descoberta'
  }
});
```

### Com GPT e Cache

```typescript
const detector = new DetectorIntencao({
  enableGpt: true,
  openaiApiKey: process.env.OPENAI_API_KEY,
  enableCache: true,
  redisUrl: process.env.REDIS_URL,
  cacheExpireSec: 3600  // 1 hora
});

const resultado = await detector.detectar({
  mensagem: 'Talvez não seja a solução certa agora'
});
```

## Componentes Internos

### ValidadorIntencao

Valida entradas e saídas do componente:

```typescript
ValidadorIntencao.validarEntrada(mensagem, historico, contexto);
ValidadorIntencao.validarResultado(resultado);
ValidadorIntencao.normalizarConfianca(valor);
ValidadorIntencao.validarRespostaGpt(resposta);
```

### AnalisadorFallback

Análise por palavras-chave (sempre disponível):

```typescript
const resultado = AnalisadorFallback.analisar(mensagem, historico);
```

Principais palavras-chave por intenção:
- **QUER_AGENDAR**: agendar, marcar, hora, horário, quando...
- **QUER_MAIS_INFO**: informações, detalhes, como funciona, explicar...
- **TEM_OBJECAO**: mas, porém, muito caro, não tenho, já existe...
- **DEMONSTRA_INTERESSE**: interessante, legal, top, perfeito, ótimo...
- **NAO_INTERESSADO**: sem interesse, não vou, não preciso...
- **NAO_RESPONDEU**: "ok", "sim", "não", respostas vagas...

### GerenciadorCache

Gerencia cache com Redis:

```typescript
// Obter do cache
const resultado = await cache.obter(mensagem, contexto);

// Armazenar no cache
await cache.armazenar(mensagem, resultado, contexto);

// Limpar cache específico
await cache.limparChave(mensagem, contexto);

// Limpar tudo
await cache.limparTudo();

// Verificar disponibilidade
if (cache.ehDisponivel()) { ... }
```

## Configuração

```typescript
interface DetectorConfig {
  redisUrl?: string;           // URL do Redis
  openaiApiKey?: string;       // Chave API OpenAI
  enableCache?: boolean;       // Ativar cache (padrão: true)
  enableFallback?: boolean;    // Ativar fallback (padrão: true)
  enableGpt?: boolean;         // Ativar GPT (padrão: true)
  cacheExpireSec?: number;     // TTL do cache em segundos (padrão: 3600)
}
```

## Variáveis de Ambiente

```bash
# OpenAI
OPENAI_API_KEY=sk_...

# Redis
REDIS_URL=redis://localhost:6379

# Logs
LOG_LEVEL=info  # debug, info, warn, error
```

## Testes

Executar todos os testes:

```bash
npm run test
```

Executar com cobertura:

```bash
npm run test:coverage
```

Testes incluem:
- ✅ Validação de entradas/saídas
- ✅ Análise por palavras-chave (fallback)
- ✅ Casos complexos e histórico
- ✅ Casos de borda (Unicode, caracteres especiais, etc)
- ✅ Integração de cache
- ✅ Fluxo completo de conversa

## Logs Estruturados

O componente utiliza **Pino** para logs estruturados:

```
[info] Cache Redis conectado com sucesso
[debug] Enviando requisição para GPT
[info] Intenção detectada via cache | tempo: 2ms | origem: cache | confianca: 85
[warn] Resposta GPT inválida | erro: Intenção inválida
[error] Erro ao detectar intenção | erro: ...
```

## Tratamento de Erros

O componente garante:
- ✅ Nunca falha - sempre retorna um resultado
- ✅ Fallback automático quando GPT falha
- ✅ Validação rigorosa de todas as entradas
- ✅ Logs detalhados de cada falha
- ✅ Confiança 0 quando input inválido

## Performance

- **Cache hit**: < 5ms
- **Fallback**: < 50ms
- **GPT**: 500-2000ms (com fallback como backup)

## Integração com Orquestrador

O componente segue a arquitetura do Klaus V2:
- ✅ Responsabilidade única
- ✅ Sem dependências circulares
- ✅ Interface pública clara
- ✅ Contrato imutável
- ✅ Pronto para produção

## Próximos Componentes

Este componente é a entrada para:
- **Componente 2**: Geração de Perguntas (usa intenção detectada)
- **Componente 7**: Orquestrador (coordena fluxo)
- **Componente 6**: Qualificação (usa intenção para scoring)

## Segurança

O componente:
- ✅ Valida todas as entradas
- ✅ Normaliza dados para prevenir injeção
- ✅ Limita tamanho de mensagens (10.000 caracteres)
- ✅ Sanitiza respostas do GPT
- ✅ Implementa rate limiting via Redis

## FAQ

**P: Por que não usar apenas GPT?**
R: GPT é poderoso mas lento e caro. Fallback oferece resposta instantânea.

**P: Como adicionar novas intenções?**
R: Modificar o enum `Intencao` em `types.ts` e adicionar keywords em `constants.ts`.

**P: Cache persiste entre reinicializações?**
R: Sim, se Redis está configurado. Sem Redis, é apenas em memória.

**P: Posso customizar as palavras-chave?**
R: Sim, edite `FALLBACK_KEYWORDS` em `constants.ts`.

**P: Qual confiança é "suficiente"?**
R: Depende do caso. GPT: >= 70. Fallback: >= 60.

## Licença

MIT - Klaus V2
