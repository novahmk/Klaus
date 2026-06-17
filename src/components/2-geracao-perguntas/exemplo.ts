/**
 * Exemplo de uso do Componente 2 - Gerador de Perguntas
 * Klaus V2
 */

import { GeradorPerguntas, CamadaPergunta } from './index';
import { Intencao } from '../1-deteccao-intencao';

async function exemploBasico() {
  console.log('=== Exemplo Básico ===\n');

  const gerador = new GeradorPerguntas({
    enableFallback: true,
    enableGpt: false,
    enableCache: false
  });

  // Exemplo 1: Primeira pergunta (Camada 1 - Necessidade)
  const resultado1 = await gerador.gerar({
    tema: 'Automação de Vendas',
    historico: [
      {
        papel: 'sistema',
        conteudo: 'Olá! Como posso ajudá-lo hoje?',
        timestamp: new Date()
      },
      {
        papel: 'lead',
        conteudo: 'Oi, estou procurando uma solução de vendas',
        timestamp: new Date()
      }
    ],
    intencao: Intencao.QUER_MAIS_INFO,
    clienteId: 'lead-001',
    perguntasJaFeitas: []
  });

  console.log('Pergunta 1 (Necessidade):');
  console.log(`  → ${resultado1.pergunta}`);
  console.log(`  Contexto esperado: ${resultado1.contextoEsperado}`);
  console.log(`  Origem: ${resultado1.origem}`);
  console.log();

  // Exemplo 2: Segunda pergunta (Camada 2 - Objeção)
  const resultado2 = await gerador.gerar({
    tema: 'Automação de Vendas',
    historico: [
      {
        papel: 'lead',
        conteudo: 'Nosso maior desafio é qualificar leads rapidamente',
        timestamp: new Date()
      },
      {
        papel: 'sistema',
        conteudo: resultado1.pergunta,
        timestamp: new Date()
      }
    ],
    intencao: Intencao.DEMONSTRA_INTERESSE,
    clienteId: 'lead-001',
    perguntasJaFeitas: [resultado1.pergunta]
  });

  console.log('Pergunta 2 (Objeção):');
  console.log(`  → ${resultado2.pergunta}`);
  console.log(`  Contexto esperado: ${resultado2.contextoEsperado}`);
  console.log();

  // Exemplo 3: Terceira pergunta (Camada 3 - Confirmação)
  const resultado3 = await gerador.gerar({
    tema: 'Automação de Vendas',
    historico: [
      {
        papel: 'lead',
        conteudo: 'Precisamos de uma solução que se integre ao Salesforce',
        timestamp: new Date()
      },
      {
        papel: 'sistema',
        conteudo: resultado2.pergunta,
        timestamp: new Date()
      }
    ],
    intencao: Intencao.QUER_AGENDAR,
    clienteId: 'lead-001',
    perguntasJaFeitas: [resultado1.pergunta, resultado2.pergunta]
  });

  console.log('Pergunta 3 (Confirmação):');
  console.log(`  → ${resultado3.pergunta}`);
  console.log(`  Contexto esperado: ${resultado3.contextoEsperado}`);
  console.log();

  await gerador.fechar();
}

async function exemploComDiferentesIntencoes() {
  console.log('\n=== Exemplo com Diferentes Intenções ===\n');

  const gerador = new GeradorPerguntas({
    enableFallback: true,
    enableGpt: false,
    enableCache: false
  });

  const intencoes = [
    { tipo: Intencao.QUER_AGENDAR, nome: 'Quer Agendar' },
    { tipo: Intencao.QUER_MAIS_INFO, nome: 'Quer Mais Info' },
    { tipo: Intencao.TEM_OBJECAO, nome: 'Tem Objeção' },
    { tipo: Intencao.DEMONSTRA_INTERESSE, nome: 'Demonstra Interesse' }
  ];

  const historico = [
    {
      papel: 'lead' as const,
      conteudo: 'Oi, estou interessado em conhecer sua solução' as const,
      timestamp: new Date()
    }
  ];

  for (const intencao of intencoes) {
    const resultado = await gerador.gerar({
      tema: 'CRM Enterprise',
      historico,
      intencao: intencao.tipo,
      clienteId: 'lead-002',
      perguntasJaFeitas: []
    });

    console.log(`[${intencao.nome}] → ${resultado.pergunta}`);
  }

  await gerador.fechar();
}

async function exemploComCache() {
  console.log('\n=== Exemplo com Cache (sem Redis, apenas estrutura) ===\n');

  const gerador = new GeradorPerguntas({
    enableFallback: true,
    enableGpt: false,
    enableCache: true
    // redisUrl: process.env.REDIS_URL (para usar Redis real)
  });

  // Primeira chamada - vai gerar via template
  const resultado1 = await gerador.gerar({
    tema: 'Marketing Automation',
    historico: [
      {
        papel: 'lead',
        conteudo: 'Oi',
        timestamp: new Date()
      }
    ],
    intencao: Intencao.QUER_MAIS_INFO,
    clienteId: 'lead-003',
    perguntasJaFeitas: []
  });

  console.log(`1ª chamada (gerada): ${resultado1.pergunta}`);

  // Segunda chamada com mesmos parâmetros - tentaria usar cache se Redis estivesse ativo
  const resultado2 = await gerador.gerar({
    tema: 'Marketing Automation',
    historico: [
      {
        papel: 'lead',
        conteudo: 'Oi',
        timestamp: new Date()
      }
    ],
    intencao: Intencao.QUER_MAIS_INFO,
    clienteId: 'lead-003',
    perguntasJaFeitas: []
  });

  console.log(`2ª chamada (seria cache): ${resultado2.pergunta}`);

  await gerador.fechar();
}

// Executar exemplos
(async () => {
  try {
    await exemploBasico();
    await exemploComDiferentesIntencoes();
    await exemploComCache();
    console.log('\n✅ Todos os exemplos executados com sucesso!');
  } catch (erro) {
    console.error('Erro:', erro);
    process.exit(1);
  }
})();
