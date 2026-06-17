// src/components/5-geracao-resposta/exemplo.ts
/**
 * Exemplo de uso do Componente 5 - Geração de Resposta (Fallback IA)
 * Klaus V2
 *
 * NOTA: Requer OpenAI API, PostgreSQL e Redis. Enquanto a integração com o
 * banco de dados não estiver disponível, use como referência de uso.
 */

import { OpenAI } from 'openai';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { ComponenteGeracao } from './component';
import { GeracaoInput } from './types';

async function exemploGeracao() {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

  const componente = new ComponenteGeracao(openai, pool, redis);

  const input: GeracaoInput = {
    clienteId: '7f8e9a00-0000-0000-0000-000000000000',
    leadId: '1a2b3c00-0000-0000-0000-000000000000',
    objecao: 'Achei o valor acima do nosso orçamento atual.',
    tipoObjecao: 'PRECO',
    contextoLead: {
      cargo: 'Diretor Clínico',
      empresa: 'Clínica Vida',
      nicho: 'saude',
      estagio: 'em_conversa'
    },
    baseConhecimento: {
      diferenciais: ['ROI em 3 meses', 'Suporte dedicado'],
      preco: 'R$ 2.000/mês'
    },
    historico: [{ remetente: 'lead', texto: 'Está muito caro.' }]
  };

  const resultado = await componente.executar(input);

  console.log(`Resposta: ${resultado.resposta}`);
  console.log(`Confiança: ${resultado.confianca}`);

  await redis.quit();
  await pool.end();
}

(async () => {
  try {
    await exemploGeracao();
    console.log('\n✅ Exemplo executado com sucesso!');
  } catch (erro) {
    console.error('Erro:', (erro as Error).message);
    process.exit(1);
  }
})();
