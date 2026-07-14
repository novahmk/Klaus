// src/components/7-orquestracao/orchestrator.ts
import { MensagemLead, RespostaKlaus, EstadoConversa } from './types';
import { StateMachine } from './state-machine';
import { CircuitBreaker } from './circuit-breaker';
import { CacheManager } from './cache-manager';
import { ErrorHandler } from './error-handler';
import { ORCHESTRATOR_CONFIG } from './constants';
import { avaliarRegras } from '../../modules/regras-conversa';
import { logger } from '../../shared/logger';

export class OrquestradorKlaus {
  private circuitBreaker = new CircuitBreaker(
    ORCHESTRATOR_CONFIG.CIRCUIT_BREAKER.FAILURE_THRESHOLD,
    ORCHESTRATOR_CONFIG.CIRCUIT_BREAKER.RESET_TIMEOUT
  );

  constructor(
    private stateMachine: StateMachine,
    private cache: CacheManager,
    private comp1_Deteccao: any,
    private comp2_Perguntas: any,
    private comp3_Busca: any,
    private comp5_Gerador: any,
    private comp6_Qualificador: any
  ) {}

  async processar(mensagem: MensagemLead): Promise<RespostaKlaus> {
    const startTime = Date.now();
    const cacheKey = this.cache.gerarChave(mensagem.leadId, mensagem.texto);

    // 1. Verificação de Cache
    const cached = await this.cache.get<RespostaKlaus>(cacheKey);
    if (cached) return cached;

    let estado: EstadoConversa = EstadoConversa.INICIAL;

    try {
      // 2. Detecção de Intenção (Componente 1)
      estado = EstadoConversa.ANALISANDO_INTENCAO;
      const intencao: any = await this.circuitBreaker.execute(() =>
        ErrorHandler.retry(
          () => this.comp1_Deteccao.detectar(mensagem),
          ORCHESTRATOR_CONFIG.RETRY.MAX_TENTATIVAS,
          ORCHESTRATOR_CONFIG.RETRY.BACKOFF_INICIAL
        )
      );

      // 3. Roteamento Lógico
      let contextoAdicional = '';
      if (
        ['TEM_OBJECAO', 'QUER_MAIS_INFO'].includes(intencao.intencao)
      ) {
        estado = EstadoConversa.BUSCANDO_CONHECIMENTO;
        contextoAdicional = await this.comp3_Busca.buscar({
          texto: mensagem.texto,
          intencao: intencao.intencao,
          leadId: mensagem.leadId,
          clienteId: mensagem.clienteId,
          metadata: mensagem.metadata
        });
      }

      // 4. Geração de Resposta (Componente 5)
      estado = EstadoConversa.GERANDO_RESPOSTA;
      const respostaFinal = await this.comp5_Gerador.gerar({
        mensagem: mensagem.texto,
        intencao: intencao.intencao,
        contexto: contextoAdicional,
        leadId: mensagem.leadId,
        clienteId: mensagem.clienteId,
        metadata: mensagem.metadata
      });

      // 5. Qualificação (Componente 6)
      estado = EstadoConversa.QUALIFICANDO_LEAD;
      const qualificacao = await this.comp6_Qualificador.analisar({
        leadId: mensagem.leadId,
        clienteId: mensagem.clienteId,
        texto: mensagem.texto,
        intencao: intencao.intencao,
        metadata: mensagem.metadata
      });
      const scoreQualificacao =
        qualificacao.score ?? qualificacao.scoreQualificacao ?? 0;
      const estagioAtual: string = qualificacao.estagio ?? 'QUALIFICADO';

      // Sprint 8: motor de regras de conversa dinâmicas (opt-in, nunca
      // bloqueia o fluxo principal em caso de falha/indisponibilidade).
      let acaoRecomendada: string | undefined;
      if (process.env.DYNAMIC_RULES_ENABLED === 'true') {
        try {
          const resultadoRegra = await avaliarRegras(mensagem.clienteId, {
            score: scoreQualificacao,
            estagio: estagioAtual,
            tentativas: 0
          });
          acaoRecomendada = resultadoRegra?.acao;
        } catch (erro) {
          logger.warn(
            { clienteId: mensagem.clienteId, erro: (erro as Error).message },
            'Orquestrador: falha ao avaliar regras de conversa dinâmicas'
          );
        }
      }

      const resultado: RespostaKlaus = {
        texto: respostaFinal,
        intencaoDetectada: intencao.intencao,
        confianca: intencao.confianca,
        scoreQualificacao,
        sugerirAgendamento:
          intencao.intencao === 'QUER_AGENDAR' || scoreQualificacao > 80,
        metadata: {
          tempoProcessamento: Date.now() - startTime,
          tokensUsados: 0, // Calculado pelos componentes
          origem: 'orchestrator_v2',
          ...(acaoRecomendada ? { acaoRecomendada } : {})
        }
      };

      await this.cache.set(cacheKey, resultado);
      return resultado;
    } catch (error) {
      console.error(
        `[ORCHESTRATOR ERROR] Estado: ${estado} | Erro: ${(error as Error).message}`
      );
      return this.gerarRespostaErro(estado);
    }
  }

  private gerarRespostaErro(_estado: EstadoConversa): RespostaKlaus {
    return {
      texto: ErrorHandler.getFallbackResponse(),
      intencaoDetectada: 'ERRO_SISTEMA',
      confianca: 0,
      scoreQualificacao: 0,
      sugerirAgendamento: false,
      metadata: { tempoProcessamento: 0, tokensUsados: 0, origem: 'fallback' }
    };
  }
}
