// src/components/7-orquestracao/exemplo.ts
/**
 * Exemplo de uso do Componente 7 - Orquestrador Enterprise
 * Klaus V2
 *
 * NOTA: Requer Redis e os Componentes 1-6 reais. Aqui usamos implementações
 * placeholder para ilustrar o fluxo de orquestração.
 */

import Redis from 'ioredis';
import { OrquestradorKlaus } from './orchestrator';
import { StateMachine } from './state-machine';
import { CacheManager } from './cache-manager';
import { MensagemLead } from './types';

async function exemploOrquestracao() {
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  const stateMachine = new StateMachine();
  const cache = new CacheManager(redis);

  // Componentes placeholder (substituir pelos reais 1-6)
  const comp1Deteccao = {
    async detectar(_msg: MensagemLead) {
      return { intencao: 'QUER_MAIS_INFO', confianca: 0.92 };
    }
  };
  const comp2Perguntas = {};
  const comp3Busca = {
    async buscar(_texto: string) {
      return 'Base de conhecimento: planos e diferenciais.';
    }
  };
  const comp5Gerador = {
    async gerar(_input: unknown) {
      return 'Claro! Posso te explicar como funciona. O que mais gostaria de saber?';
    }
  };
  const comp6Qualificador = {
    async analisar(_leadId: string) {
      return { score: 85 };
    }
  };

  const orquestrador = new OrquestradorKlaus(
    stateMachine,
    cache,
    comp1Deteccao,
    comp2Perguntas,
    comp3Busca,
    comp5Gerador,
    comp6Qualificador
  );

  const mensagem: MensagemLead = {
    id: 'msg-1',
    texto: 'Como funciona o plano premium?',
    leadId: 'lead-456',
    clienteId: 'cliente-123'
  };

  const resposta = await orquestrador.processar(mensagem);

  console.log(`Resposta: ${resposta.texto}`);
  console.log(`Intenção: ${resposta.intencaoDetectada}`);
  console.log(`Score: ${resposta.scoreQualificacao}`);
  console.log(`Sugerir agendamento: ${resposta.sugerirAgendamento}`);
  console.log(`Tempo: ${resposta.metadata.tempoProcessamento}ms`);

  await redis.quit();
}

(async () => {
  try {
    await exemploOrquestracao();
    console.log('\n✅ Exemplo executado com sucesso!');
  } catch (erro) {
    console.error('Erro:', (erro as Error).message);
    process.exit(1);
  }
})();
