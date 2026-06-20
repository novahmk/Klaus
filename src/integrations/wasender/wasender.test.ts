// src/integrations/wasender/wasender.test.ts
/**
 * Testes - Integração WASenderAPI
 * Klaus V2
 *
 * Cobrem parser, auth, rate-limit, normalização e processor (com stubs).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { parsePayloadWASender } from './parser';
import { safeCompare, createFallbackMessageId } from './auth';
import { checarRateLimitTelefone, checarRateLimitIp } from './rate-limit';
import { normalizarTelefone } from './client';

describe('WASender - parser', () => {
  it('deve extrair do formato data.messages', () => {
    const parsed = parsePayloadWASender({
      sessionId: 'sess-1',
      data: {
        messages: {
          key: { id: 'ABC123', cleanedSenderPn: '5511999998888' },
          messageBody: 'Olá, quero saber mais',
          pushName: 'João'
        }
      }
    });

    expect(parsed.from).toBe('5511999998888');
    expect(parsed.texto).toBe('Olá, quero saber mais');
    expect(parsed.pushName).toBe('João');
    expect(parsed.messageId).toBe('ABC123');
    expect(parsed.webhookSessionId).toBe('sess-1');
  });

  it('deve detectar fromMe e ignorar', () => {
    const parsed = parsePayloadWASender({
      data: { messages: { key: { fromMe: true }, messageBody: 'bot' } }
    });
    expect(parsed.fromMe).toBe(true);
  });

  it('deve extrair áudio (pttMessage)', () => {
    const parsed = parsePayloadWASender({
      data: {
        messages: {
          key: { id: 'X', cleanedSenderPn: '551199' },
          message: { pttMessage: { url: 'enc://a', mediaKey: 'k' } }
        }
      }
    });
    expect(parsed.audioMessage?._type).toBe('ptt');
    expect(parsed.audioUrl).toBe('enc://a');
  });

  it('deve suportar formato data flat', () => {
    const parsed = parsePayloadWASender({
      data: { from: '551198', message: 'oi' }
    });
    expect(parsed.from).toBe('551198');
    expect(parsed.texto).toBe('oi');
  });

  it('deve suportar formato flat (corpo direto)', () => {
    const parsed = parsePayloadWASender({ from: '551197', text: 'eai' });
    expect(parsed.from).toBe('551197');
    expect(parsed.texto).toBe('eai');
  });

  it('deve retornar from null quando não há remetente', () => {
    const parsed = parsePayloadWASender({ foo: 'bar' });
    expect(parsed.from).toBeNull();
  });
});

describe('WASender - auth', () => {
  it('safeCompare deve validar strings iguais', () => {
    expect(safeCompare('abc', 'abc')).toBe(true);
    expect(safeCompare('abc', 'abd')).toBe(false);
    expect(safeCompare('abc', 'abcd')).toBe(false);
    expect(safeCompare('', '')).toBe(false);
  });

  it('createFallbackMessageId deve ser determinístico no mesmo bucket', () => {
    const id1 = createFallbackMessageId('+5511999', 'oi');
    const id2 = createFallbackMessageId('+5511999', 'oi');
    expect(id1).toBe(id2);
    expect(id1).toHaveLength(32); // md5 hex
  });

  it('createFallbackMessageId deve diferir por remetente', () => {
    const id1 = createFallbackMessageId('+5511999', 'oi');
    const id2 = createFallbackMessageId('+5511888', 'oi');
    expect(id1).not.toBe(id2);
  });
});

describe('WASender - normalizarTelefone', () => {
  it('deve remover sufixos e não-dígitos', () => {
    expect(normalizarTelefone('whatsapp:+55 (11) 99999-8888')).toBe(
      '5511999998888'
    );
    expect(normalizarTelefone('5511999998888@s.whatsapp.net')).toBe(
      '5511999998888'
    );
    expect(normalizarTelefone('123@lid')).toBe('123');
  });
});

describe('WASender - rate-limit', () => {
  it('deve permitir até o limite por telefone e bloquear depois', () => {
    const phone = `+55119${Date.now()}`;
    let permitidas = 0;
    for (let i = 0; i < 15; i++) {
      if (checarRateLimitTelefone(phone)) permitidas++;
    }
    expect(permitidas).toBe(10);
  });

  it('deve permitir até o limite por IP', () => {
    const ip = `10.0.0.${Math.floor(Math.random() * 255)}`;
    let permitidas = 0;
    for (let i = 0; i < 120; i++) {
      if (checarRateLimitIp(ip)) permitidas++;
    }
    expect(permitidas).toBe(100);
  });
});

describe('WASender - processor', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('modo direct deve chamar o orquestrador e retornar o texto', async () => {
    process.env.PROCESSING_MODE = 'direct';
    vi.resetModules();
    const { configurarProcessor, processarMensagem } = await import('./processor');

    const processar = vi.fn(() => Promise.resolve({ texto: 'resposta IA' }));
    configurarProcessor({ orquestrador: { processar } });

    const resposta = await processarMensagem({
      from: '+5511999998888',
      texto: 'oi',
      pushName: 'João',
      leadId: '5511999998888',
      clienteId: 'cliente-1',
      messageId: 'm1'
    });

    expect(processar).toHaveBeenCalledOnce();
    expect(resposta).toEqual(
      expect.objectContaining({ enfileirada: false, resposta: 'resposta IA' })
    );
  });

  it('modo queue deve enfileirar e retornar null', async () => {
    process.env.PROCESSING_MODE = 'queue';
    vi.resetModules();
    const { configurarProcessor, processarMensagem } = await import('./processor');

    const addJob = vi.fn(() => Promise.resolve({ id: 'job-1' }));
    configurarProcessor({ queueManager: { addJob } });

    const resposta = await processarMensagem({
      from: '+5511999998888',
      texto: 'oi',
      pushName: 'João',
      leadId: '5511999998888',
      clienteId: 'cliente-1',
      messageId: 'm1'
    });

    expect(addJob).toHaveBeenCalledOnce();
    expect(resposta).toEqual(
      expect.objectContaining({ enfileirada: true, jobId: 'job-1' })
    );
  });

  it('modo queue sem QueueManager deve lançar erro (não descartar)', async () => {
    process.env.PROCESSING_MODE = 'queue';
    vi.resetModules();
    const { processarMensagem } = await import('./processor');

    await expect(
      processarMensagem({
        from: '+5511999998888',
        texto: 'oi',
        pushName: 'João',
        leadId: '5511999998888',
        clienteId: 'cliente-1',
        messageId: 'm1'
      })
    ).rejects.toThrow(/QueueManager não inicializado/);
  });
});
