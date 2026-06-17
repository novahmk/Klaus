/**
 * Exemplo de uso do Componente 1 - Detecção de Intenção
 * Klaus V2
 */

import { DetectorIntencao, Intencao } from './index';

async function exemploBasico() {
  console.log('=== Exemplo Básico ===\n');

  // Inicializar detector com fallback (sem GPT, sem cache)
  const detector = new DetectorIntencao({
    enableFallback: true,
    enableGpt: false,
    enableCache: false
  });

  // Exemplo 1: Detecção simples
  const resultado1 = await detector.detectar({
    mensagem: 'Gostaria de agendar uma reunião'
  });

  console.log('Input: "Gostaria de agendar uma reunião"');
  console.log(`Resultado:`, {
    intencao: resultado1.intencao,
    confianca: resultado1.confianca,
    origem: resultado1.origem
  });
  console.log();

  // Exemplo 2: Com histórico
  const resultado2 = await detector.detectar({
    mensagem: 'Parece ótimo, quando podemos conversar?',
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

  console.log(
    'Input (com histórico): "Parece ótimo, quando podemos conversar?"'
  );
  console.log(`Resultado:`, {
    intencao: resultado2.intencao,
    confianca: resultado2.confianca,
    origem: resultado2.origem
  });
  console.log();

  // Exemplo 3: Com contexto
  const resultado3 = await detector.detectar({
    mensagem: 'Muito caro para nosso orçamento',
    contexto: {
      leadId: 'lead-123',
      empresa: 'Tech Startup',
      segmento: 'SaaS'
    }
  });

  console.log(
    'Input (com contexto): "Muito caro para nosso orçamento"'
  );
  console.log(`Resultado:`, {
    intencao: resultado3.intencao,
    confianca: resultado3.confianca,
    motivo: resultado3.motivo,
    origem: resultado3.origem
  });
  console.log();

  // Exemplo 4: Com GPT (requer chave API)
  // const detectorComGpt = new DetectorIntencao({
  //   enableGpt: true,
  //   openaiApiKey: process.env.OPENAI_API_KEY,
  //   enableFallback: true, // Fallback como backup
  // });
  //
  // const resultado4 = await detectorComGpt.detectar({
  //   mensagem: 'Talvez no próximo trimestre'
  // });

  await detector.fechar();
}

async function exemploCaseComplex() {
  console.log('\n=== Caso Complexo de Conversa ===\n');

  const detector = new DetectorIntencao({
    enableFallback: true,
    enableGpt: false,
    enableCache: false
  });

  const conversas = [
    {
      papel: 'lead',
      mensagem: 'Oi',
      esperado: Intencao.NAO_RESPONDEU
    },
    {
      papel: 'lead',
      mensagem: 'Quero saber mais sobre a solução',
      esperado: Intencao.QUER_MAIS_INFO
    },
    {
      papel: 'lead',
      mensagem: 'Parece interessante!',
      esperado: Intencao.DEMONSTRA_INTERESSE
    },
    {
      papel: 'lead',
      mensagem: 'Mas o preço parece alto',
      esperado: Intencao.TEM_OBJECAO
    },
    {
      papel: 'lead',
      mensagem: 'Mesmo assim, gostaria de agendar uma demo',
      esperado: Intencao.QUER_AGENDAR
    },
    {
      papel: 'lead',
      mensagem: 'Não tenho mais interesse',
      esperado: Intencao.NAO_INTERESSADO
    }
  ];

  for (const conversa of conversas) {
    const resultado = await detector.detectar({
      mensagem: conversa.mensagem
    });

    const acertou = resultado.intencao === conversa.esperado;
    const simbolo = acertou ? '✓' : '✗';

    console.log(`${simbolo} "${conversa.mensagem}"`);
    console.log(`  Detectado: ${resultado.intencao} (confiança: ${resultado.confianca}%)`);
    console.log(`  Esperado:  ${conversa.esperado}`);
    console.log();
  }

  await detector.fechar();
}

// Executar exemplos
(async () => {
  try {
    await exemploBasico();
    await exemploCaseComplex();
  } catch (erro) {
    console.error('Erro:', erro);
    process.exit(1);
  }
})();
