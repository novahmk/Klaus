// src/components/6-qualificacao/component.test.ts
/**
 * Testes - Componente 6: Qualificação de Leads
 * Klaus V2
 *
 * Cobrem a lógica independente de DB/WhatsApp/WebSocket, usando stubs.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Pool } from 'pg';
import { CalculadorScore } from './calculator';
import { AnalisadorHistorico } from './analyzer';
import { NotificadorWhatsApp, WhasenderClient } from './notifier';
import { NotificadorDashboard, SocketServer } from './dashboard-notifier';
import { ComponenteQualificacao } from './component';
import { PESOS, SCORES_INTENCAO } from './constants';
import { QualificacaoInput } from './types';
import * as configLoader from '../../modules/config-loader';

vi.mock('../../modules/config-loader', () => ({
  obterConfigScoring: vi.fn()
}));

function criarInput(overrides: Partial<QualificacaoInput> = {}): QualificacaoInput {
  return {
    clienteId: 'cliente-1',
    leadId: 'lead-1',
    intencao: 'QUER_AGENDAR',
    historico: [{}, {}, {}, {}, {}, {}, {}, {}, {}, {}],
    contextoLead: {
      nome: 'João Silva',
      telefone: '11999999999',
      email: 'joao@empresa.com',
      cargo: 'CEO',
      empresa: 'Clínica Vida',
      nicho: 'saude'
    },
    ...overrides
  };
}

describe('Componente 6 - CalculadorScore', () => {
  let calc: CalculadorScore;

  beforeEach(() => {
    calc = new CalculadorScore();
  });

  it('deve calcular score com fórmula ponderada (QUER_AGENDAR + alto engajamento + CEO)', () => {
    // intencao=100, engajamento=min(10*10,100)=100, contexto=90 (cargo), historico=80
    const esperado =
      100 * PESOS.INTENCAO +
      100 * PESOS.ENGAJAMENTO +
      90 * PESOS.CONTEXTO +
      80 * PESOS.HISTORICO;
    expect(calc.calcular(criarInput())).toBeCloseTo(esperado, 5);
  });

  it('deve usar 0 para intenção desconhecida', () => {
    const score = calc.calcular(
      criarInput({ intencao: 'INTENCAO_INEXISTENTE', historico: [] })
    );
    // intencao=0, engajamento=0, contexto=90, historico=80
    const esperado = 0 + 0 + 90 * PESOS.CONTEXTO + 80 * PESOS.HISTORICO;
    expect(score).toBeCloseTo(esperado, 5);
  });

  it('deve reduzir contexto quando não há cargo', () => {
    const comCargo = calc.calcular(criarInput());
    const semCargo = calc.calcular(
      criarInput({
        contextoLead: {
          nome: 'Lead',
          telefone: '0',
          email: 'l@x.com'
        }
      })
    );
    expect(comCargo).toBeGreaterThan(semCargo);
  });

  it('deve limitar engajamento a 100', () => {
    const muitas = Array.from({ length: 50 }, () => ({}));
    const score = calc.calcular(criarInput({ historico: muitas }));
    const esperado =
      100 * PESOS.INTENCAO +
      100 * PESOS.ENGAJAMENTO +
      90 * PESOS.CONTEXTO +
      80 * PESOS.HISTORICO;
    expect(score).toBeCloseTo(esperado, 5);
  });

  it('deve refletir SCORES_INTENCAO por tipo', () => {
    const agendar = calc.calcular(criarInput({ intencao: 'QUER_AGENDAR' }));
    const objecao = calc.calcular(criarInput({ intencao: 'TEM_OBJECAO' }));
    expect(agendar).toBeGreaterThan(objecao);
    expect(SCORES_INTENCAO['QUER_AGENDAR']).toBe(100);
    expect(SCORES_INTENCAO['NAO_INTERESSADO']).toBe(0);
  });

  it('Sprint 7: deve aceitar pesos e scores de intenção customizados (override dinâmico)', () => {
    const pesosCustom = { INTENCAO: 0.7, ENGAJAMENTO: 0.1, CONTEXTO: 0.1, HISTORICO: 0.1 };
    const scoresCustom = { QUER_AGENDAR: 50 };

    const scorePadrao = calc.calcular(criarInput());
    const scoreCustom = calc.calcular(criarInput(), pesosCustom, scoresCustom);

    const esperadoCustom =
      50 * pesosCustom.INTENCAO +
      100 * pesosCustom.ENGAJAMENTO +
      90 * pesosCustom.CONTEXTO +
      80 * pesosCustom.HISTORICO;

    expect(scoreCustom).toBeCloseTo(esperadoCustom, 5);
    expect(scoreCustom).not.toBeCloseTo(scorePadrao, 5);
  });

  it('Sprint 7: sem argumentos extras deve continuar usando PESOS/SCORES_INTENCAO padrão', () => {
    const esperado =
      100 * PESOS.INTENCAO +
      100 * PESOS.ENGAJAMENTO +
      90 * PESOS.CONTEXTO +
      80 * PESOS.HISTORICO;
    expect(calc.calcular(criarInput())).toBeCloseTo(esperado, 5);
  });
});

describe('Componente 6 - AnalisadorHistorico', () => {
  it('deve retornar total de mensagens e métricas', () => {
    const analyzer = new AnalisadorHistorico();
    const resultado = analyzer.analisar([{}, {}, {}]);
    expect(resultado.totalMensagens).toBe(3);
    expect(resultado.sentimento).toBe('positivo');
    expect(resultado.taxaResposta).toBe(1.0);
  });
});

describe('Componente 6 - NotificadorWhatsApp', () => {
  it('deve enviar mensagem formatada com os dados do lead', async () => {
    const sendSpy = vi.fn(() => Promise.resolve({ status: 'enviado' }));
    const whasender: WhasenderClient = { sendMessage: sendSpy };
    const notifier = new NotificadorWhatsApp(whasender);

    await notifier.enviar('11988888888', {
      nome: 'João Silva',
      telefone: '11999999999',
      prioridade: 10
    });

    expect(sendSpy).toHaveBeenCalledOnce();
    const args = sendSpy.mock.calls[0][0] as {
      phone: string;
      message: string;
    };
    expect(args.phone).toBe('11988888888');
    expect(args.message).toContain('João Silva');
    expect(args.message).toContain('10/10');
  });
});

describe('Componente 6 - NotificadorDashboard', () => {
  it('deve emitir para a room do cliente', () => {
    const emitSpy = vi.fn();
    const io: SocketServer = {
      to: vi.fn(() => ({ emit: emitSpy }))
    };
    const notifier = new NotificadorDashboard(io);

    const resultado = notifier.enviar('cliente-1', { leadId: 'lead-1' });

    expect(io.to).toHaveBeenCalledWith('cliente-cliente-1');
    expect(emitSpy).toHaveBeenCalledWith('lead-qualificado', {
      leadId: 'lead-1'
    });
    expect(resultado).toBe(true);
  });
});

describe('Componente 6 - ComponenteQualificacao.executar', () => {
  let querySpy: ReturnType<typeof vi.fn>;
  let dbStub: Pool;
  let whatsappEnviar: ReturnType<typeof vi.fn>;
  let dashboardEnviar: ReturnType<typeof vi.fn>;
  let componente: ComponenteQualificacao;

  beforeEach(() => {
    querySpy = vi.fn(() =>
      Promise.resolve({
        rows: [{ numero_whatsapp_atendente: '11988888888' }]
      })
    );
    dbStub = { query: querySpy } as unknown as Pool;

    whatsappEnviar = vi.fn(() => Promise.resolve({ status: 'enviado' }));
    dashboardEnviar = vi.fn(() => true);

    componente = new ComponenteQualificacao(
      dbStub,
      { enviar: whatsappEnviar } as unknown as NotificadorWhatsApp,
      { enviar: dashboardEnviar } as unknown as NotificadorDashboard
    );
  });

  it('deve qualificar e disparar notificações quando score >= 70', async () => {
    const resultado = await componente.executar(criarInput());

    expect(resultado.scoreQualificacao).toBeGreaterThanOrEqual(70);
    expect(querySpy).toHaveBeenCalledOnce();
    expect(whatsappEnviar).toHaveBeenCalledOnce();
    expect(dashboardEnviar).toHaveBeenCalledOnce();
  });

  it('deve marcar PRONTO_PARA_HANDOFF quando score >= 90', async () => {
    const resultado = await componente.executar(criarInput());
    expect(resultado.scoreQualificacao).toBeGreaterThanOrEqual(90);
    expect(resultado.estagio).toBe('PRONTO_PARA_HANDOFF');
  });

  it('não deve notificar quando score < 70', async () => {
    // intencao=NAO_INTERESSADO(0), historico vazio (engajamento 0), sem cargo (contexto 50)
    const resultado = await componente.executar(
      criarInput({
        intencao: 'NAO_INTERESSADO',
        historico: [],
        contextoLead: { nome: 'Lead', telefone: '0', email: 'l@x.com' }
      })
    );

    expect(resultado.scoreQualificacao).toBeLessThan(70);
    expect(querySpy).not.toHaveBeenCalled();
    expect(whatsappEnviar).not.toHaveBeenCalled();
    expect(dashboardEnviar).not.toHaveBeenCalled();
  });

  it('deve calcular prioridade como ceil(score/10)', async () => {
    const resultado = await componente.executar(criarInput());
    expect(resultado.prioridade).toBe(Math.ceil(resultado.scoreQualificacao / 10));
  });

  describe('Sprint 7: scoring dinâmico via Supabase (DYNAMIC_SCORING_ENABLED)', () => {
    const obterConfigScoringMock = vi.mocked(configLoader.obterConfigScoring);

    afterEach(() => {
      delete process.env.DYNAMIC_SCORING_ENABLED;
      obterConfigScoringMock.mockReset();
    });

    it('deve ignorar config dinâmica quando a flag está desligada', async () => {
      process.env.DYNAMIC_SCORING_ENABLED = 'false';
      await componente.executar(criarInput());
      expect(obterConfigScoringMock).not.toHaveBeenCalled();
    });

    it('deve usar pesos/scores/thresholds customizados quando a flag está ligada', async () => {
      process.env.DYNAMIC_SCORING_ENABLED = 'true';
      obterConfigScoringMock.mockResolvedValue({
        cliente_id: 'cliente-1',
        pesos: { intencao: 0.7, engajamento: 0.1, contexto: 0.1, historico: 0.1 },
        scores_intencao: { QUER_AGENDAR: 50 },
        threshold_handoff: 95,
        threshold_notificacao: 60,
        atualizado_em: new Date().toISOString()
      });

      const resultado = await componente.executar(criarInput());

      const esperado =
        50 * 0.7 + 100 * 0.1 + 90 * 0.1 + 80 * 0.1;
      expect(resultado.scoreQualificacao).toBeCloseTo(esperado, 5);
      expect(resultado.estagio).toBe('QUALIFICADO'); // esperado < threshold_handoff=95
      expect(whatsappEnviar).toHaveBeenCalledOnce(); // esperado >= threshold_notificacao=60
    });

    it('deve cair nos defaults quando obterConfigScoring retorna null', async () => {
      process.env.DYNAMIC_SCORING_ENABLED = 'true';
      obterConfigScoringMock.mockResolvedValue(null);

      const resultado = await componente.executar(criarInput());

      const esperado =
        100 * PESOS.INTENCAO +
        100 * PESOS.ENGAJAMENTO +
        90 * PESOS.CONTEXTO +
        80 * PESOS.HISTORICO;
      expect(resultado.scoreQualificacao).toBeCloseTo(esperado, 5);
    });
  });
});
