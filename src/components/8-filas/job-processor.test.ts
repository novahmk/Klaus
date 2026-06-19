import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JobProcessor } from './job-processor';
import { QueueName, KlausJobPayload } from './types';

const mocks = vi.hoisted(() => ({
  enviarMensagem: vi.fn(() => Promise.resolve({ ok: true })),
  salvarMensagem: vi.fn(() => Promise.resolve())
}));

vi.mock('../../integrations/wasender/client', () => ({
  enviarMensagem: mocks.enviarMensagem
}));

vi.mock('../../infra/memory', () => ({
  salvarMensagem: mocks.salvarMensagem
}));

describe('JobProcessor - WASender outbound', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve processar inbound e enfileirar resposta outbound', async () => {
    const processar = vi.fn(() =>
      Promise.resolve({
        texto: 'Resposta gerada',
        intencaoDetectada: 'QUER_MAIS_INFO',
        scoreQualificacao: 82
      })
    );
    const addJob = vi.fn(() => Promise.resolve({ id: 'out-1' }));
    const processor = new JobProcessor(
      { processar } as any,
      { addJob } as any
    );

    const payload: KlausJobPayload = {
      leadId: '5511999998888',
      clienteId: 'cliente-1',
      mensagem: 'Quero saber mais',
      timestamp: new Date('2026-06-18T12:00:00.000Z'),
      metadata: {
        from: '+5511999998888',
        pushName: 'João',
        messageId: 'msg-1'
      }
    };

    const resultado = await (processor as any).processInbound({
      id: 'job-1',
      data: payload
    });

    expect(processar).toHaveBeenCalledWith(
      expect.objectContaining({
        texto: 'Quero saber mais',
        leadId: '5511999998888',
        clienteId: 'cliente-1',
        metadata: expect.objectContaining({
          from: '+5511999998888',
          pushName: 'João',
          messageId: 'msg-1'
        })
      })
    );
    expect(addJob).toHaveBeenCalledWith(
      QueueName.OUTBOUND_RESPONSES,
      expect.objectContaining({
        leadId: '5511999998888',
        clienteId: 'cliente-1',
        mensagem: 'Resposta gerada',
        metadata: expect.objectContaining({
          to: '+5511999998888',
          origemJobId: 'job-1',
          intencaoDetectada: 'QUER_MAIS_INFO',
          scoreQualificacao: 82
        })
      }),
      0
    );
    expect(resultado).toEqual(
      expect.objectContaining({
        success: true,
        respostaGerada: 'Resposta gerada'
      })
    );
  });

  it('deve enviar outbound via WASenderAPI e persistir resposta', async () => {
    const processor = new JobProcessor({ processar: vi.fn() } as any, {
      addJob: vi.fn()
    } as any);

    const payload: KlausJobPayload = {
      leadId: '5511999998888',
      clienteId: 'cliente-1',
      mensagem: 'Resposta enviada',
      timestamp: new Date('2026-06-18T12:00:00.000Z'),
      metadata: { to: '+5511999998888' }
    };

    const resultado = await (processor as any).processOutbound({
      id: 'out-1',
      data: payload
    });

    expect(mocks.enviarMensagem).toHaveBeenCalledWith(
      '+5511999998888',
      'Resposta enviada'
    );
    expect(mocks.salvarMensagem).toHaveBeenCalledWith(
      '5511999998888',
      'assistant',
      'Resposta enviada'
    );
    expect(resultado).toEqual(
      expect.objectContaining({
        success: true,
        respostaGerada: 'Resposta enviada'
      })
    );
  });
});