// src/components/6-qualificacao/component.ts
import { Pool } from 'pg';
import { CalculadorScore } from './calculator';
import { NotificadorWhatsApp } from './notifier';
import { NotificadorDashboard } from './dashboard-notifier';
import { QualificacaoInput } from './types';

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
    const score = calc.calcular(input);
    const prioridade = Math.ceil(score / 10);
    const estagio =
      score >= 90 ? 'PRONTO_PARA_HANDOFF' : 'QUALIFICADO';

    if (score >= 70) {
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
}
