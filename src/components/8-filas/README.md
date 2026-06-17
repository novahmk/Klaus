# Componente 8: Sistema de Filas Enterprise (BullMQ)

## Visão Geral

O **Componente 8** é a espinha dorsal de processamento do Klaus V2. Implementa uma
arquitetura baseada em filas (Message Queuing) usando **BullMQ sobre Redis**,
desacoplando a recepção de mensagens (ingestion) do processamento inteligente
(orquestração). Isso garante que nenhuma mensagem seja perdida, gerencia picos de
tráfego, executa retentativas automáticas e escala horizontalmente.

> **Estado atual:** A infraestrutura BullMQ/Redis está pendente. O código segue a
> especificação literal e está pronto para conectar a um Redis ativo. Os testes cobrem
> a lógica pura (`RetryStrategy`) e as configurações; as classes que dependem de
> Redis/BullMQ aguardam a integração da infraestrutura de filas.

## Estrutura de Pastas

```
src/components/8-filas/
├── types.ts               # QueueName, KlausJobPayload, JobResult, QueueConfig
├── constants.ts           # DEFAULT_QUEUE_CONFIG, REDIS_CONNECTION_CONFIG
├── queue-manager.ts       # QueueManager (singleton, gerencia filas BullMQ)
├── job-processor.ts       # JobProcessor (workers que consomem as filas)
├── retry-strategy.ts      # RetryStrategy (backoff exponencial + jitter)
├── monitoring.ts          # QueueMonitoring (telemetria das filas)
├── index.ts               # Exportações públicas
├── exemplo.ts             # Exemplo de uso
├── retry-strategy.test.ts # Testes
└── README.md              # Esta documentação
```

## Filas

| Fila | Concorrência | Tentativas | Backoff |
|---|---|---|---|
| `inbound_messages` | 50 | 5 | exponencial (2s base) |
| `outbound_responses` | 30 | 3 | fixo (5s) |
| `notification_alerts` | 10 | 2 | fixo (10s) |

A maior concorrência das mensagens inbound prioriza o tempo de resposta ao lead.

## Fluxo de Processamento

```
WhatsApp Webhook
  → QueueManager.addJob(INBOUND_MESSAGES)        [Waiting]
  → Worker captura o job                          [Active]
  → JobProcessor → OrquestradorKlaus.processar()
       sucesso → [Completed] (removido do Redis)
       falha   → RetryStrategy → [Delayed] → retry
       exaustão → Dead Letter Queue (DLQ)
  → QueueManager.addJob(OUTBOUND_RESPONSES)
  → Outbound Worker → WhatsApp API Send
```

## Resiliência

- **Retry com Backoff Exponencial**:

  $$delay = base \times 2^{(tentativas - 1)} + jitter$$

  O jitter (0-1000ms) evita o *Thundering Herd Problem*.
- **Dead Letter Queue (DLQ)**: jobs que falham persistentemente (`removeOnFail: false`)
  são preservados para análise manual.
- **Garantia At-least-once**: o BullMQ usa scripts Lua atômicos no Redis; se o worker
  cair, o lock expira e o job volta para a fila.

## Uso

```typescript
import {
  QueueManager,
  JobProcessor,
  QueueMonitoring,
  QueueName
} from './components/8-filas';

// Singleton de filas
const queueManager = QueueManager.getInstance();

// Workers (o Orquestrador do Comp. 7 vira o handler)
const processor = new JobProcessor(orquestrador);
processor.start();

// Enfileirar mensagem com prioridade
await queueManager.addJob(
  QueueName.INBOUND_MESSAGES,
  { leadId: 'lead-456', clienteId: 'cliente-123', mensagem: 'Olá', timestamp: new Date() },
  10
);

// Métricas
const metrics = await new QueueMonitoring(queueManager).getMetrics();
```

## Integração com Componentes 1-7

O **Componente 7 (Orquestrador)** deixa de ser executor direto e passa a ser o
**handler do worker**:

1. **Entrada**: WhatsApp → Webhook → `QueueManager.addJob(INBOUND)`.
2. **Processamento**: `JobProcessor` → `Orquestrador.processar()` → Componentes 1-6.
3. **Saída**: Orquestrador retorna resposta → `QueueManager.addJob(OUTBOUND)`.
4. **Envio**: Outbound Worker → WhatsApp API.

> O `JobProcessor` adapta o payload da fila ao contrato do Comp. 7
> (`MensagemLead` exige `id`; o resultado mapeia `intencaoDetectada` e `texto`).

## Monitoramento (KPIs)

- **Throughput**: jobs processados por minuto.
- **Error Rate**: % de falhas na 1ª tentativa vs. falha total.
- **Queue Latency**: tempo médio em estado `waiting`.
- **Redis Memory**: consumo do cluster para evitar OOM.

## Boas Práticas (produção)

- Redis com persistência **AOF** e política `noeviction`.
- Instância Redis **exclusiva** para o BullMQ (separada do cache de aplicação).
- Campo `version` no payload para evitar erros de parse em deploys.
- **Graceful Shutdown** (SIGTERM) para finalizar jobs ativos antes de encerrar.

## Testes

```bash
NODE_ENV=test npm run test -- --run src/components/8-filas
```

Cobertura atual:
- `RetryStrategy.calculateBackoff`: fórmula exponencial, jitter, monotonia, base
- `DEFAULT_QUEUE_CONFIG`: shape, concorrência e tipos de backoff por fila

> `QueueManager`, `JobProcessor` e `QueueMonitoring` dependem de Redis/BullMQ ativos
> e serão validados junto à integração da infraestrutura de filas.

## Dependências

```json
{ "dependencies": { "bullmq": "^5.0.0", "ioredis": "^5.3.2" } }
```

## Conclusão do Ecossistema

1. ✅ Componente 1: Detecção de Intenção
2. ✅ Componente 2: Geração de Perguntas
3. ✅ Componente 3: Busca no Banco de Dados
4. ✅ Componente 4: Ranking de Objeções Adaptativo
5. ✅ Componente 5: Geração de Resposta (Fallback IA)
6. ✅ Componente 6: Qualificação de Leads com Notificações
7. ✅ Componente 7: Orquestrador Enterprise
8. ✅ Componente 8: Sistema de Filas Enterprise (BullMQ)
