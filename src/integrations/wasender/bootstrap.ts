// src/integrations/wasender/bootstrap.ts
import Redis from 'ioredis';
import { OpenAI } from 'openai';
import { getPool } from '../../infra/database';
import { DetectorIntencao, Intencao } from '../../components/1-deteccao-intencao';
import { BuscadorBanco } from '../../components/3-busca-banco';
import { ComponenteGeracao, TipoObjecao } from '../../components/5-geracao-resposta';
import { CalculadorScore, PESOS, SCORES_INTENCAO } from '../../components/6-qualificacao';
import {
  CacheManager,
  MensagemLead,
  OrquestradorKlaus,
  StateMachine
} from '../../components/7-orquestracao';
import { OpenAIClient, getOpenAIConfig } from '../openai';
import { contarMensagensLead } from '../../modules/inbound/supabase-gateway';
import { obterConfigScoring } from '../../modules/config-loader';
import { logger } from '../../shared/logger';

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
  });

  const buscador = new BuscadorBanco(
    pool,
    redis,
    criarOpenAIClient(openaiApiKey)
  );

  const gerador = openaiApiKey
    ? new ComponenteGeracao(new OpenAI({ apiKey: openaiApiKey }), pool, redis)
    : null;

  const comp1Adapter = {
    detectar: (mensagem: MensagemLead) =>
      detector.detectar({
        mensagem: mensagem.texto,
        contexto: {
          leadId: mensagem.leadId,
          faseFunil: String(mensagem.metadata?.faseFunil || 'inicial')
        }
      })
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
      if (!gerador) return textoFallback(input.mensagem);

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
    async analisar(
      input: QualificacaoAdapterInput
    ): Promise<{ score: number; estagio: string }> {
      // Engajamento real: quanto mais mensagens o lead já trocou, maior o
      // score. Fallback seguro para 1 quando Supabase indisponível.
      const numMensagens = await contarMensagensLead(input.leadId);
      const historico = Array.from(
        { length: Math.max(numMensagens, 1) },
        () => ({ remetente: 'lead', texto: '' })
      );

      // Sprint 7: scoring dinâmico via dashboard (cfg_scoring). Opt-in por
      // env var; nunca bloqueia — cai nos defaults hardcoded em caso de falha.
      // Notificação WhatsApp/dashboard NÃO é acionada aqui (fica isolada do
      // fluxo do orquestrador para evitar dependência da tabela legada).
      let pesos = PESOS;
      let scoresIntencao = SCORES_INTENCAO;
      let thresholdHandoff = 90;

      if (process.env.DYNAMIC_SCORING_ENABLED === 'true') {
        try {
          const cfg = await obterConfigScoring(input.clienteId);
          if (cfg) {
            pesos = {
              INTENCAO: cfg.pesos.intencao,
              ENGAJAMENTO: cfg.pesos.engajamento,
              CONTEXTO: cfg.pesos.contexto,
              HISTORICO: cfg.pesos.historico
            };
            scoresIntencao = cfg.scores_intencao;
            thresholdHandoff = cfg.threshold_handoff;
          }
        } catch (erro) {
          logger.warn(
            { clienteId: input.clienteId, erro: (erro as Error).message },
            'Qualificação: falha ao obter scoring dinâmico, usando defaults'
          );
        }
      }

      const score = calculador.calcular(
        {
          clienteId: input.clienteId,
          leadId: input.leadId,
          intencao: input.intencao,
          historico,
          contextoLead: {
            nome: String(input.metadata?.pushName || 'Lead'),
            telefone: String(input.metadata?.from || input.leadId),
            email: String(input.metadata?.email || ''),
            cargo: String(input.metadata?.cargo || '')
          }
        },
        pesos,
        scoresIntencao
      );

      const estagio =
        score >= thresholdHandoff ? 'PRONTO_PARA_HANDOFF' : 'QUALIFICADO';

      return { score, estagio };
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