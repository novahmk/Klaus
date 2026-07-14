// src/components/6-qualificacao/component.ts
import { Pool } from 'pg';
import { CalculadorScore, PesosScore } from './calculator';
import { NotificadorWhatsApp } from './notifier';
import { NotificadorDashboard } from './dashboard-notifier';
import { QualificacaoInput } from './types';
import { PESOS, SCORES_INTENCAO } from './constants';
import { obterConfigScoring } from '../../modules/config-loader';
import { logger } from '../../shared/logger';

const THRESHOLD_HANDOFF_DEFAULT = 90;
const THRESHOLD_NOTIFICACAO_DEFAULT = 70;

export class ComponenteQualificacao {
  constructor(
    private db: Pool,
    private whatsapp: NotificadorWhatsApp,
    private dashboard: NotificadorDashboard
  ) {}

  async executar(input: QualificacaoInput): Promise<{
    scoreQualificacao: number;
    prioridade: number;
    estagio: string;
  }> {
    const calc = new CalculadorScore();

    let pesos: PesosScore = PESOS;
    let scoresIntencao: Record<string, number> = SCORES_INTENCAO;
    let thresholdHandoff = THRESHOLD_HANDOFF_DEFAULT;
    let thresholdNotificacao = THRESHOLD_NOTIFICACAO_DEFAULT;

    if (process.env.DYNAMIC_SCORING_ENABLED === 'true') {
      try {
        const configScoring = await obterConfigScoring(input.clienteId);
        if (configScoring) {
          pesos = {
            INTENCAO: configScoring.pesos.intencao,
            ENGAJAMENTO: configScoring.pesos.engajamento,
            CONTEXTO: configScoring.pesos.contexto,
            HISTORICO: configScoring.pesos.historico
          };
          scoresIntencao = configScoring.scores_intencao;
          thresholdHandoff = configScoring.threshold_handoff;
          thresholdNotificacao = configScoring.threshold_notificacao;
        }
      } catch (erro) {
        logger.warn(
          { clienteId: input.clienteId, erro: (erro as Error).message },
          'Qualificação: falha ao obter scoring dinâmico, usando defaults'
        );
      }
    }

    const score = calc.calcular(input, pesos, scoresIntencao);
    const prioridade = Math.ceil(score / 10);
    const estagio =
      score >= thresholdHandoff ? 'PRONTO_PARA_HANDOFF' : 'QUALIFICADO';

    if (score >= thresholdNotificacao) {
      const config = await this.db.query(
        'SELECT * FROM configuracao_notificacoes WHERE cliente_id = $1',
        [input.clienteId]
      );

      await this.whatsapp.enviar(
        config.rows[0].numero_whatsapp_atendente,
        {
          nome: input.contextoLead.nome,
          telefone: input.contextoLead.telefone,
          prioridade
        }
      );

      this.dashboard.enviar(input.clienteId, {
        leadId: input.leadId,
        score,
        prioridade
      });
    }

    return { scoreQualificacao: score, prioridade, estagio };
  }

  async analisar(input: {
    leadId: string;
    clienteId: string;
    texto: string;
    intencao: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ score: number; scoreQualificacao: number; estagio: string }> {
    const resultado = await this.executar({
      leadId: input.leadId,
      clienteId: input.clienteId,
      intencao: input.intencao,
      historico: [{ remetente: 'lead', texto: input.texto }],
      contextoLead: {
        nome: String(input.metadata?.pushName || 'Lead'),
        telefone: String(input.metadata?.from || input.leadId),
        email: String(input.metadata?.email || '')
      }
    });

    return {
      score: resultado.scoreQualificacao,
      scoreQualificacao: resultado.scoreQualificacao,
      estagio: resultado.estagio
    };
  }
}
