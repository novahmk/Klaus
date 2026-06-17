# Componente 7: Orquestrador Enterprise Robusto

## Visão Geral

O **Componente 7 (Orquestrador)** é o núcleo de coordenação do Klaus V2 — o "maestro"
do sistema. Gerencia o ciclo de vida completo de uma interação, do recebimento da
mensagem bruta do lead até a entrega de uma resposta qualificada e contextualizada.

Usa uma arquitetura **baseada em estados e eventos**: cada componente especializado
(Detecção, Busca, Geração e Qualificação) é acionado no momento exato, com a saída de
um servindo de entrada enriquecida para o próximo, sob supervisão de mecanismos de
resiliência (Circuit Breaker, retries com backoff e cache de deduplicação).

> **Estado atual:** A integração com Redis e os Componentes 1-6 reais está pendente. O
> código segue a especificação literal. Os testes cobrem state machine, circuit breaker,
> retries, cache e o fluxo de `processar` com stubs dos componentes.

## Estrutura de Pastas

```
src/components/7-orquestracao/
├── types.ts             # EstadoConversa, MensagemLead, RespostaKlaus, ContextoOrquestracao
├── constants.ts         # ORCHESTRATOR_CONFIG (timeouts, retry, circuit breaker, cache)
├── state-machine.ts     # StateMachine (transições válidas)
├── circuit-breaker.ts   # CircuitBreaker (CLOSED/OPEN/HALF_OPEN)
├── cache-manager.ts     # CacheManager (sha256 + get/set)
├── error-handler.ts     # ErrorHandler (retry + fallback)
├── orchestrator.ts      # OrquestradorKlaus (classe principal)
├── index.ts             # Exportações públicas
├── exemplo.ts           # Exemplo de uso
├── orchestrator.test.ts # Testes
└── README.md            # Esta documentação
```

## Princípios Arquiteturais

1. **Resiliência a Falhas**: Circuit Breakers isolam componentes instáveis; retries com backoff exponencial tratam falhas transientes.
2. **Otimização de Custos**: cache de respostas via hash de conteúdo evita reprocessamento de mensagens repetidas.
3. **Estrutura Validada**: State Machine garante que a conversa nunca entre em estado impossível.
4. **Performance e Timeouts**: timeouts granulares por etapa.
5. **Separação de Responsabilidades**: o orquestrador apenas coordena, não executa lógica de negócio.
6. **Injeção de Dependências**: componentes injetados, facilitando testes e substituição de provedores.

## Máquina de Estados

```
INICIAL → ANALISANDO_INTENCAO → BUSCANDO_CONHECIMENTO → GERANDO_RESPOSTA
  → QUALIFICANDO_LEAD → AGUARDANDO_LEAD → (ANALISANDO_INTENCAO | FINALIZADO)
```

`ERRO` é acessível a partir de qualquer estado de processamento; `FINALIZADO` volta a
`INICIAL`. `StateMachine.validarTransicao(atual, proximo)` valida cada passo.

## Resiliência

- **Circuit Breaker**: se um componente falhar `FAILURE_THRESHOLD` (5) vezes seguidas, o
  circuito abre por `RESET_TIMEOUT` (60s). Durante esse período, chamadas retornam erro
  imediato (fallback), economizando recursos. Depois, entra em `HALF_OPEN` e fecha no
  primeiro sucesso.
- **Backoff Exponencial**: as tentativas crescem (500ms → 1000ms → 2000ms), evitando
  sobrecarga de serviços em recuperação.

## Configuração (`ORCHESTRATOR_CONFIG`)

| Grupo | Valores |
|---|---|
| TIMEOUTS | DETECCAO 3s, BUSCA 5s, GERACAO 8s, QUALIFICACAO 2s, GLOBAL 20s |
| RETRY | MAX_TENTATIVAS 3, BACKOFF_INICIAL 500ms |
| CIRCUIT_BREAKER | FAILURE_THRESHOLD 5, RESET_TIMEOUT 60s |
| CACHE | TTL_PADRAO 3600s, PREFIXO `klaus:v2:orch:` |

## Fluxo de `processar`

```
MensagemLead
  → Cache (deduplicação por sha256) → hit? retorna
  → Detecção (Comp 1) via CircuitBreaker + retry
  → Roteamento: TEM_OBJECAO | QUER_MAIS_INFO → Busca (Comp 3)
  → Geração (Comp 5)
  → Qualificação (Comp 6)
  → grava no cache → RespostaKlaus
  (catch) → resposta de fallback
```

## Uso

```typescript
import Redis from 'ioredis';
import {
  OrquestradorKlaus,
  StateMachine,
  CacheManager
} from './components/7-orquestracao';

const redis = new Redis(process.env.REDIS_URL);
const orquestrador = new OrquestradorKlaus(
  new StateMachine(),
  new CacheManager(redis),
  comp1Deteccao,
  comp2Perguntas,
  comp3Busca,
  comp5Gerador,
  comp6Qualificador
);

const resposta = await orquestrador.processar({
  id: 'msg-1',
  texto: 'Como funciona o plano premium?',
  leadId: 'lead-456',
  clienteId: 'cliente-123'
});
```

## Otimização de Tokens

- **Cache de Intenção**: mensagens idênticas não disparam novas chamadas de IA.
- **Validação de Escopo**: mensagens Out of Scope/Spam encerram o fluxo antes dos
  geradores caros.
- **Histórico Compacto**: o orquestrador resume o histórico enviado aos componentes.

> A validação de escopo e a rota de clarificação por baixa confiança (<40%) são previstas
> na especificação e serão habilitadas junto à integração dos componentes reais.

## Testes

```bash
NODE_ENV=test npm run test -- --run src/components/7-orquestracao
```

Cobertura atual:
- `StateMachine`: transições válidas/inválidas
- `CircuitBreaker`: execução normal, abertura por threshold, HALF_OPEN após reset
- `ErrorHandler`: retry com backoff, sucesso após falha transiente, fallbacks
- `CacheManager`: chave sha256 determinística, get/set, TTL padrão
- `OrquestradorKlaus.processar`: fluxo completo, roteamento, cache hit, fallback de erro

## Integração com Outros Componentes

| Componente | Papel no fluxo |
|---|---|
| Comp 1 (Detecção) | Trigger lógico do fluxo |
| Comp 2 (Perguntas) | Acionado quando falta dado para QUER_AGENDAR |
| Comp 3 (Busca) | Base de conhecimento para QUER_MAIS_INFO / TEM_OBJECAO |
| Comp 4 (Ranking) | Filtra melhores respostas da busca |
| Comp 5 (Geração) | Transforma dados em linguagem natural |
| Comp 6 (Qualificação) | Atualiza o progresso do lead |

## Próximos Passos

1. ✅ Componente 1: Detecção de Intenção
2. ✅ Componente 2: Geração de Perguntas
3. ✅ Componente 3: Busca no Banco de Dados
4. ✅ Componente 4: Ranking de Objeções Adaptativo
5. ✅ Componente 5: Geração de Resposta (Fallback IA)
6. ✅ Componente 6: Qualificação de Leads com Notificações
7. ✅ Componente 7: Orquestrador Enterprise
8. ⏳ Componente 8: Sistema de Filas (BullMQ)
