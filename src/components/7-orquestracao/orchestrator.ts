// src/components/7-orquestracao/orchestrator.ts
import { MensagemLead, RespostaKlaus, EstadoConversa } from './types';
import { StateMachine } from './state-machine';
import { CircuitBreaker } from './circuit-breaker';
import { CacheManager } from './cache-manager';
import { ErrorHandler } from './error-handler';
import { ORCHESTRATOR_CONFIG } from './constants';

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
        contextoAdicional = await this.comp3_Busca.buscar(mensagem.texto);
      }

      // 4. Geração de Resposta (Componente 5)
      estado = EstadoConversa.GERANDO_RESPOSTA;
      const respostaFinal = await this.comp5_Gerador.gerar({
        mensagem: mensagem.texto,
        intencao: intencao.intencao,
        contexto: contextoAdicional
      });

      // 5. Qualificação (Componente 6)
      estado = EstadoConversa.QUALIFICANDO_LEAD;
      const qualificacao = await this.comp6_Qualificador.analisar(
        mensagem.leadId
      );

      const resultado: RespostaKlaus = {
        texto: respostaFinal,
        intencaoDetectada: intencao.intencao,
        confianca: intencao.confianca,
        scoreQualificacao: qualificacao.score,
        sugerirAgendamento:
          intencao.intencao === 'QUER_AGENDAR' || qualificacao.score > 80,
        metadata: {
          tempoProcessamento: Date.now() - startTime,
          tokensUsados: 0, // Calculado pelos componentes
          origem: 'orchestrator_v2'
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
