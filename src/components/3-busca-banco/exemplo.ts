// src/components/3-busca-banco/exemplo.ts
/**
 * Exemplo de uso do Componente 3 - Busca no Banco de Dados
 * Klaus V2
 *
 * NOTA: Este exemplo requer uma conexão ativa com PostgreSQL (com a extensão
 * pgvector), Redis e a OpenAI API. Enquanto a integração com o banco de dados
 * não estiver disponível no ambiente, utilize-o como referência de uso.
 */

import { Pool } from 'pg';
import Redis from 'ioredis';
import { OpenAIClient } from '../../integrations/openai/client';
import { BuscadorBanco } from './searcher';
import { Intencao } from '../1-deteccao-intencao/types';

async function exemploBusca() {
  // Inicializar dependências
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  const openaiClient = new OpenAIClient(process.env.OPENAI_API_KEY);

  // Instanciar o buscador
  const buscador = new BuscadorBanco(pool, redis, openaiClient);

  // Executar uma busca por informação
  const resultado = await buscador.buscar({
    intencao: Intencao.QUER_MAIS_INFO,
    objecao: 'Preço',
    contexto: {
      tema: 'Transplante capilar',
      historico: 'Lead: Qual é o preço?',
      numeroMensagens: 2,
      tempoNoFunil: 1
    },
    clienteId: 'cliente-123',
    leadId: 'lead-456'
  });

  console.log(`Total encontrado: ${resultado.totalEncontrado}`);
  console.log(`Origem: ${resultado.origem}`);
  console.log(`Tempo: ${resultado.tempoExecucao}ms`);

  if (resultado.respostas.length > 0) {
    console.log(`Melhor resposta: ${resultado.respostas[0].conteudo}`);

    // Registrar uso para analytics e melhoria de efetividade
    await buscador.registrarUso(
      'cliente-123',
      'lead-456',
      resultado.respostas[0].id,
      resultado.respostas[0].tipo,
      true
    );
  }

  // Encerrar conexões
  await redis.quit();
  await pool.end();
}

async function exemploObjecao() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  const openaiClient = new OpenAIClient(process.env.OPENAI_API_KEY);

  const buscador = new BuscadorBanco(pool, redis, openaiClient);

  const resultado = await buscador.buscar({
    intencao: Intencao.TEM_OBJECAO,
    objecao: 'Está muito caro',
    contexto: {
      tema: 'Plano Premium',
      historico: 'Lead: Achei caro demais',
      numeroMensagens: 5,
      tempoNoFunil: 3
    },
    clienteId: 'cliente-123',
    leadId: 'lead-789'
  });

  console.log(`Respostas para objeção: ${resultado.totalEncontrado}`);

  await redis.quit();
  await pool.end();
}

// Executar exemplos
(async () => {
  try {
    await exemploBusca();
    await exemploObjecao();
    console.log('\n✅ Exemplos executados com sucesso!');
  } catch (erro) {
    console.error('Erro:', (erro as Error).message);
    process.exit(1);
  }
})();
