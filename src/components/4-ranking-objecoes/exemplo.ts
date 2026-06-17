// src/components/4-ranking-objecoes/exemplo.ts
/**
 * Exemplo de uso do Componente 4 - Ranking de Objeções Adaptativo
 * Klaus V2
 *
 * NOTA: Requer conexão ativa com PostgreSQL e Redis. Enquanto a integração
 * com o banco de dados não estiver disponível, use como referência de uso.
 */

import { Pool } from 'pg';
import Redis from 'ioredis';
import { ComponenteRanking } from './component';
import { Pergunta } from './types';

async function exemploRanking() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

  const ranking = new ComponenteRanking(pool, redis);

  const candidatas: Pergunta[] = [
    {
      id: 'gen-1',
      texto: 'Qual é o maior desafio do seu atendimento hoje?',
      tipo: 'generica',
      nicho: 'saude',
      tema: 'atendimento',
      dificuldade: 'media'
    },
    {
      id: 'pers-1',
      texto: 'Como você mede a satisfação no seu método exclusivo?',
      tipo: 'personalizada',
      nicho: 'saude',
      tema: 'metodo',
      dificuldade: 'alta'
    }
  ];

  const resultado = await ranking.executar({
    clienteId: '7f8e9a00-0000-0000-0000-000000000000',
    leadId: '1a2b3c00-0000-0000-0000-000000000000',
    intencao: 'QUER_MAIS_INFO',
    contextoLead: {
      nicho: 'saude',
      cargo: 'Diretor Clínico',
      estagio: 'em_conversa'
    },
    perguntasCandidatas: candidatas
  });

  console.log(`Pergunta Selecionada: ${resultado.perguntaSelecionada.texto}`);
  console.log(`Score: ${resultado.score}`);
  console.log(`Motivo: ${resultado.motivo}`);

  await redis.quit();
  await pool.end();
}

(async () => {
  try {
    await exemploRanking();
    console.log('\n✅ Exemplo executado com sucesso!');
  } catch (erro) {
    console.error('Erro:', (erro as Error).message);
    process.exit(1);
  }
})();
