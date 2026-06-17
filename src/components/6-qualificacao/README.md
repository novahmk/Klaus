# Componente 6: Qualificação de Leads com Notificações Inteligentes

## Visão Geral

O **Componente 6** é a camada final de inteligência do Klaus V2 antes da intervenção
humana. Atua como filtro de alta precisão que analisa a jornada do lead para determinar
o momento exato em que a automação deve ceder espaço ao atendimento consultivo.

Quantifica o interesse do lead via um **score proprietário (0-100)** e orquestra a entrega
dessa informação para a equipe de vendas em tempo real, disparando notificações
estruturadas via **WhatsApp** e **Dashboard** ao atingir os critérios de prontidão.

> **Estado atual:** A integração com PostgreSQL, Whasender (WhatsApp) e Socket.io
> (WebSocket) está pendente. O código segue a especificação literal. Os testes cobrem
> cálculo de score, análise de histórico, notificadores (stubs) e o fluxo de `executar`.

## Estrutura de Pastas

```
src/components/6-qualificacao/
├── types.ts              # QualificacaoInput, ContextoLead, QualificacaoOutput
├── constants.ts          # PESOS e SCORES_INTENCAO
├── calculator.ts         # CalculadorScore (fórmula ponderada)
├── analyzer.ts           # AnalisadorHistorico
├── notifier.ts           # NotificadorWhatsApp
├── dashboard-notifier.ts # NotificadorDashboard (Socket.io)
├── cache.ts              # CacheQualificacao (ioredis)
├── component.ts          # ComponenteQualificacao (classe principal)
├── index.ts              # Exportações públicas
├── exemplo.ts            # Exemplo de uso
├── component.test.ts     # Testes
└── README.md             # Esta documentação
```

## Fórmula de Qualificação

$$Score = (Intenção \times 0.4) + (Engajamento \times 0.3) + (Contexto \times 0.2) + (Histórico \times 0.1)$$

| Pilar | Peso | Descrição |
|---|---|---|
| **Intenção** | 40% | Desejo imediato (QUER_AGENDAR=100, TEM_OBJECAO=40, …) |
| **Engajamento** | 30% | `min(nº mensagens × 10, 100)` |
| **Contexto** | 20% | Perfil do lead (cargo presente → 90, senão 50) |
| **Histórico** | 10% | Padrões anteriores (80 default para novos leads) |

### `SCORES_INTENCAO`

| Intenção | Valor |
|---|---|
| QUER_AGENDAR | 100 |
| DEMONSTRA_INTERESSE | 80 |
| QUER_MAIS_INFO | 60 |
| TEM_OBJECAO | 40 |
| NAO_RESPONDEU | 20 |
| NAO_INTERESSADO | 0 |

## Estágios do Funil

| Score | Estágio | Notificação |
|---|---|---|
| 90-100 | PRONTO_PARA_HANDOFF | WhatsApp + Dashboard (URGENTE) |
| 70-89 | QUALIFICADO | WhatsApp + Dashboard |
| < 70 | (mantém fluxo) | Nenhuma |

> Conforme o `component.ts` da especificação, o `estagio` retornado é **binário**
> (`>=90 → PRONTO_PARA_HANDOFF`, senão `QUALIFICADO`); o disparo de notificações
> ocorre quando `score >= 70`.

## Notificação WhatsApp

```
🔥 LEAD QUALIFICADO
João Silva
(11) 99999-9999
⭐ Prioridade: 10/10
📍 Lead interessado no agendamento
Qualificado em: 15/06/2026 às 10:30
```

## Notificação Dashboard

Emitida via Socket.io para a room `cliente-${clienteId}` no evento `lead-qualificado`,
alimentando Toast, Badge e Card de Qualificação na interface.

## Schema PostgreSQL

```sql
CREATE TABLE qualificacoes_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL,
  lead_id UUID NOT NULL,
  score_qualificacao NUMERIC(5,2),
  prioridade INT CHECK (prioridade BETWEEN 1 AND 10),
  estagio VARCHAR(50),
  intencao VARCHAR(50),
  recomendacao TEXT,
  notificacoes_enviadas JSONB,
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE historico_notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL,
  lead_id UUID NOT NULL,
  tipo_notificacao VARCHAR(20),
  numero_atendente VARCHAR(20),
  mensagem TEXT,
  status VARCHAR(20),
  timestamp_envio TIMESTAMP DEFAULT NOW(),
  timestamp_leitura TIMESTAMP
);

CREATE TABLE configuracao_notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID UNIQUE NOT NULL,
  numero_whatsapp_atendente VARCHAR(20),
  email_atendente VARCHAR(100),
  habilitar_whatsapp BOOLEAN DEFAULT TRUE,
  habilitar_dashboard BOOLEAN DEFAULT TRUE,
  habilitar_email BOOLEAN DEFAULT FALSE,
  score_minimo_notificacao INT DEFAULT 70,
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);
```

## Uso

```typescript
import { Pool } from 'pg';
import {
  ComponenteQualificacao,
  NotificadorWhatsApp,
  NotificadorDashboard
} from './components/6-qualificacao';

const componente = new ComponenteQualificacao(db, whatsappNotifier, dashNotifier);

const resultado = await componente.executar({
  clienteId: 'cliente-123',
  leadId: 'lead-456',
  intencao: 'QUER_AGENDAR',
  historico: [/* mensagens */],
  contextoLead: {
    nome: 'João Silva',
    telefone: '11999999999',
    email: 'joao@empresa.com',
    cargo: 'CEO'
  }
});

console.log(resultado.estagio, resultado.scoreQualificacao);
```

## Fluxo de Funcionamento

1. **Ingestão**: dados da conversa e contexto do lead.
2. **Análise**: `AnalisadorHistorico` mede o engajamento.
3. **Scoring**: `CalculadorScore` aplica a fórmula ponderada.
4. **Mapeamento**: score → estágio do funil.
5. **Decisão**: verifica se score ≥ limite de notificação (default 70).
6. **Disparo**: notificadores formatam e enviam alertas (WhatsApp + Dashboard).
7. **Registro**: eventos gravados no PostgreSQL para análise futura.

## Tratamento de Erros (previsto)

- **Falha no WhatsApp**: até 3 tentativas de reenvio; log de erro no dashboard.
- **Número inválido**: validação de formato antes do envio.
- **Contexto nulo**: fallbacks como "Lead Sem Nome" para não interromper o fluxo.

## Métricas (KPIs)

| KPI | Meta |
|---|---|
| Taxa de Qualificação (score ≥ 70) | > 30% |
| Entrega WhatsApp | > 95% |
| Tempo de Resposta (notificação → contato) | < 30 min |

## Testes

```bash
NODE_ENV=test npm run test -- --run src/components/6-qualificacao
```

Cobertura atual (independente de DB/WhatsApp/WebSocket):
- `CalculadorScore`: fórmula ponderada, limites de engajamento, contexto por cargo
- `AnalisadorHistorico`: métricas básicas
- `NotificadorWhatsApp` / `NotificadorDashboard`: envio com stubs
- `ComponenteQualificacao.executar`: gatilho ≥70, estágio, prioridade, sem notificação <70

## Integração com Outros Componentes

- Consome a saída do **Componente 1** (Intenção) e do **Componente 3** (Contexto).
- Serve como gatilho final que encerra a atuação do **Componente 5** (IA generativa),
  transferindo a responsabilidade ao operador humano.

## Próximos Passos

1. ✅ Componente 1: Detecção de Intenção
2. ✅ Componente 2: Geração de Perguntas
3. ✅ Componente 3: Busca no Banco de Dados
4. ✅ Componente 4: Ranking de Objeções Adaptativo
5. ✅ Componente 5: Geração de Resposta (Fallback IA)
6. ✅ Componente 6: Qualificação de Leads com Notificações
7. ⏳ Componente 7: Orquestração
8. ⏳ Componente 8: Sistema de Filas
