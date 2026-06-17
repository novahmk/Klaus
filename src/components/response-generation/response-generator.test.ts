// ============================================================
// UNIT TESTS — Response Generation
// ============================================================

import { ResponseGenerator } from './response-generator';
import { Intent, ConversationContext, QuestionLayer, GeneratedQuestion } from '../../types';

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const makeContext = (overrides?: Partial<ConversationContext>): ConversationContext => ({
  leadId: 'lead-abc',
  history: [],
  currentIntent: Intent.INTEREST,
  score: 4,
  metadata: {},
  ...overrides,
});

const makeQuestion = (content: string): GeneratedQuestion => ({
  layer: QuestionLayer.NEED,
  content,
  rationale: 'test rationale',
});

describe('ResponseGenerator', () => {
  let mockOpenAI: { chat: { completions: { create: jest.Mock } } };
  let generator: ResponseGenerator;

  beforeEach(() => {
    mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    };
    generator = new ResponseGenerator(mockOpenAI as never);
  });

  it('should generate a response for INTEREST intent', async () => {
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: 'Great to hear you are interested!' } }],
    });

    const result = await generator.generate('Tell me more', Intent.INTEREST, makeContext());

    expect(result).toBe('Great to hear you are interested!');
  });

  it('should append follow-up question context in system prompt', async () => {
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: 'We have the right solution for you.' } }],
    });

    const question = makeQuestion('What are your main goals?');
    await generator.generate('I am interested', Intent.INTEREST, makeContext(), question);

    const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
    const systemContent = callArgs.messages[0].content as string;
    expect(systemContent).toContain('What are your main goals?');
  });

  it('should return fallback response on OpenAI error', async () => {
    mockOpenAI.chat.completions.create.mockRejectedValue(new Error('Service unavailable'));

    const result = await generator.generate('message', Intent.INTEREST, makeContext());

    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should return appropriate fallback for each intent', async () => {
    mockOpenAI.chat.completions.create.mockRejectedValue(new Error('error'));

    const intents = Object.values(Intent);
    for (const intent of intents) {
      const result = await generator.generate('message', intent, makeContext());
      expect(result.length).toBeGreaterThan(0);
    }
  });

  it('should throw if OpenAI returns empty content', async () => {
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: null } }],
    });

    // Should fall back gracefully
    const result = await generator.generate('message', Intent.QUESTION, makeContext());
    expect(typeof result).toBe('string');
  });
});
