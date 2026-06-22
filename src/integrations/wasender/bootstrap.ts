// src/integrations/wasender/bootstrap.ts
import Redis from 'ioredis';
import { OpenAI } from 'openai';
import { getPool } from '../../infra/database';
import { DetectorIntencao, Intencao } from '../../components/1-deteccao-intencao';
import { BuscadorBanco } from '../../components/3-busca-banco';
import { ComponenteGeracao, TipoObjecao } from '../../components/5-geracao-resposta';
import { CalculadorScore } from '../../components/6-qualificacao';
import {
  CacheManager,
  MensagemLead,
  OrquestradorKlaus,
  StateMachine
} from '../../components/7-orquestracao';
import { OpenAIClient, getOpenAIConfig } from '../openai';
import { obterConfigIA } from '../../modules/ia-config';
import type { ConfigIA } from '../../modules/ia-config/types';

interface BuscaAdapterInput {
  texto: string;
  intencao: Intencao;
  leadId: string;
  clienteId: string;
  metadata?: Record<string, unknown>;
}

interface GeracaoAdapterInput {
  mensagem: string;
  intencao: Intencao;
  contexto: string;
  leadId: string;
  clienteId: string;
  metadata?: Record<string, unknown>;
}

interface QualificacaoAdapterInput {
  texto: string;
  intencao: string;
  leadId: string;
  clienteId: string;
  metadata?: Record<string, unknown>;
}

function redisUrl(): string {
  return process.env.REDIS_URL || 'redis://localhost:6379';
}

function tipoObjecaoDe(intencao: string): TipoObjecao {
  if (intencao === Intencao.TEM_OBJECAO) return 'GENERICO';
  return 'GENERICO';
}

function textoFallback(mensagem: string): string {
  const texto = mensagem.trim();
  if (texto.endsWith('?')) {
    return 'Boa pergunta. Vou te responder com base no que temos aqui e, se fizer sentido, posso te ajudar a avançar para o próximo passo.';
  }
  return 'Entendi. Me conta um pouco mais sobre o que você precisa agora para eu te orientar melhor?';
}

function criarOpenAIClient(openaiApiKey?: string): OpenAIClient {
  if (openaiApiKey) return new OpenAIClient(openaiApiKey);

  return {
    embeddings: async () => ({ data: [] })
  } as unknown as OpenAIClient;
}

export function criarOrquestradorWasender(): OrquestradorKlaus {
  const redis = new Redis(redisUrl());
  const pool = getPool();
  const openaiApiKey = getOpenAIConfig().API_KEY || undefined;

  const detector = new DetectorIntencao({
    redisUrl: redisUrl(),
    openaiApiKey,
    enableCache: true,
    enableFallback: true,
    enableGpt: Boolean(openaiApiKey)
    // iaTemperature, iaMaxTokens e iaMinConfianca são injetados por mensagem
    // no comp1Adapter abaixo, após carregar a ConfigIA do cliente.
  });

  const buscador = new BuscadorBanco(
    pool,
    redis,
    criarOpenAIClient(openaiApiKey)
  );

  // O gerador base é criado sem ConfigIA; ela é injetada por mensagem no comp5Adapter.
  const geradorBase = openaiApiKey
    ? new OpenAI({ apiKey: openaiApiKey })
    : null;

  /**
   * Carrega ConfigIA para o cliente da mensagem.
   * Usa cache interno do módulo ia-config (TTL 5 min).
   * Em caso de falha, retorna undefined e os componentes usam seus fallbacks.
   */
  async function carregarConfigIA(clienteId: string): Promise<ConfigIA | undefined> {
    try {
      return await obterConfigIA(clienteId);
    } catch {
      return undefined;
    }
  }

  const comp1Adapter = {
    async detectar(mensagem: MensagemLead) {
      // Carrega ConfigIA para injetar parâmetros dinâmicos na detecção
      const configIA = await carregarConfigIA(mensagem.clienteId);

      // Reconfigura o detector com os parâmetros do cliente para esta chamada
      if (configIA) {
        detector['config'].iaTemperature = configIA.parametros.temperature;
        detector['config'].iaMaxTokens = configIA.parametros.max_tokens;
        // min_confianca vem de cfg_ia_validacao (0-1), detector usa escala 0-100
        detector['config'].iaMinConfianca = configIA.validacao.min_confianca * 100;
      }

      return detector.detectar({
        mensagem: mensagem.texto,
        contexto: {
          leadId: mensagem.leadId,
          faseFunil: String(mensagem.metadata?.faseFunil || 'inicial')
        }
      });
    }
  };

  const comp3Adapter = {
    async buscar(input: BuscaAdapterInput): Promise<string> {
      const resultado = await buscador.buscar({
        intencao: input.intencao,
        objecao: input.intencao === Intencao.TEM_OBJECAO ? input.texto : undefined,
        clienteId: input.clienteId,
        leadId: input.leadId,
        contexto: {
          tema: input.texto,
          historico: '',
          numeroMensagens: 1,
          tempoNoFunil: 0
        }
      });

      return resultado.respostas
        .slice(0, 3)
        .map((resposta) => resposta.conteudo)
        .join('\n');
    }
  };

  const comp5Adapter = {
    async gerar(input: GeracaoAdapterInput): Promise<string> {
      if (!geradorBase) return textoFallback(input.mensagem);

      // Carrega ConfigIA para injetar parâmetros dinâmicos na geração de resposta
      const configIA = await carregarConfigIA(input.clienteId);

      const gerador = new ComponenteGeracao(
        geradorBase,
        pool,
        redis,
        configIA
      );

      const resultado = await gerador.executar({
        clienteId: input.clienteId,
        leadId: input.leadId,
        objecao: input.mensagem,
        tipoObjecao: tipoObjecaoDe(input.intencao),
        contextoLead: {
          cargo: String(input.metadata?.cargo || 'lead'),
          empresa: String(input.metadata?.empresa || 'empresa'),
          nicho: String(input.metadata?.nicho || 'geral'),
          estagio: String(input.metadata?.faseFunil || 'inicial')
        },
        baseConhecimento: input.contexto || 'Sem contexto adicional encontrado.',
        historico: [{ remetente: 'lead', texto: input.mensagem }]
      });

      return resultado.resposta || textoFallback(input.mensagem);
    }
  };

  const calculador = new CalculadorScore();
  const comp6Adapter = {
    analisar(input: QualificacaoAdapterInput): { score: number } {
      const score = calculador.calcular({
        clienteId: input.clienteId,
        leadId: input.leadId,
        intencao: input.intencao,
        historico: [{ remetente: 'lead', texto: input.texto }],
        contextoLead: {
          nome: String(input.metadata?.pushName || 'Lead'),
          telefone: String(input.metadata?.from || input.leadId),
          email: String(input.metadata?.email || ''),
          cargo: String(input.metadata?.cargo || '')
        }
      });

      return { score };
    }
  };

  return new OrquestradorKlaus(
    new StateMachine(),
    new CacheManager(redis),
    comp1Adapter,
    {},
    comp3Adapter,
    comp5Adapter,
    comp6Adapter
  );
}