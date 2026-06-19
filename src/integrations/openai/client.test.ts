import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const embeddingsCreateMock = vi.fn();
  const chatCreateMock = vi.fn();
  const OpenAIMock = vi.fn().mockImplementation(() => ({
    embeddings: {
      create: embeddingsCreateMock
    },
    chat: {
      completions: {
        create: chatCreateMock
      }
    }
  }));

  return { embeddingsCreateMock, chatCreateMock, OpenAIMock };
});

vi.mock('openai', () => ({
  default: mocks.OpenAIMock
}));

import { OpenAIClient } from './client';

describe('OpenAIClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_MODEL_EMBEDDING = 'text-embedding-3-small';
    delete process.env.OPENAI_API_KEY;
  });

  it('deve criar cliente com chave explícita', async () => {
    mocks.embeddingsCreateMock.mockResolvedValueOnce({
      data: [{ embedding: [0.1, 0.2], index: 0 }]
    });

    const client = new OpenAIClient('sk-teste');
    const result = await client.embeddings({ input: 'teste' });

    expect(mocks.OpenAIMock).toHaveBeenCalledWith({ apiKey: 'sk-teste' });
    expect(result.data[0].embedding).toEqual([0.1, 0.2]);
  });

  it('deve usar modelo de embedding do ambiente quando não informado', async () => {
    process.env.OPENAI_API_KEY = 'sk-from-env';
    process.env.OPENAI_MODEL_EMBEDDING = 'text-embedding-3-small';

    mocks.embeddingsCreateMock.mockResolvedValueOnce({
      data: [{ embedding: [0.1], index: 0 }]
    });

    const client = new OpenAIClient();
    await client.embeddings({ input: 'abc' });

    expect(mocks.embeddingsCreateMock).toHaveBeenCalledWith({
      model: 'text-embedding-3-small',
      input: 'abc'
    });
  });

  it('deve lançar erro quando OPENAI_API_KEY não estiver configurada', () => {
    expect(() => new OpenAIClient()).toThrow(/OPENAI_API_KEY/);
  });

  it('deve propagar erro da API OpenAI', async () => {
    process.env.OPENAI_API_KEY = 'sk-from-env';
    mocks.embeddingsCreateMock.mockRejectedValueOnce(new Error('rate_limited'));

    const client = new OpenAIClient();

    await expect(client.embeddings({ input: 'abc' })).rejects.toThrow('rate_limited');
  });

  it('deve gerar resposta de chat usando modelo do ambiente', async () => {
    process.env.OPENAI_API_KEY = 'sk-from-env';
    process.env.OPENAI_MODEL_CHAT = 'gpt-4o-mini';
    process.env.OPENAI_TEMPERATURE = '0.5';

    mocks.chatCreateMock.mockResolvedValueOnce({
      choices: [{ message: { content: '  Olá!  ' } }]
    });

    const client = new OpenAIClient();
    const texto = await client.chat({
      messages: [{ role: 'user', content: 'oi' }]
    });

    expect(mocks.chatCreateMock).toHaveBeenCalledWith({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'oi' }],
      temperature: 0.5,
      max_tokens: undefined
    });
    expect(texto).toBe('Olá!');
  });
});
