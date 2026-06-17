// ============================================================
// UNIT TESTS — Question Generation
// ============================================================

import { QuestionGenerator } from './question-generator';
import { Intent, QuestionLayer, ConversationContext } from '../../types';

jest.mock('../../utils/cache', () => ({
  cacheGet: jest.fn().mockResolvedValue(null),
  cacheSet: jest.fn().mockResolvedValue(undefined),
  buildCacheKey: (...parts: string[]) => parts.join(':'),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const makeContext = (overrides?: Partial<ConversationContext>): ConversationContext => ({
  leadId: 'lead-456',
  history: [],
  currentIntent: Intent.UNKNOWN,
  score: 5,
  metadata: {},
  ...overrides,
});

describe('QuestionGenerator', () => {
  let mockOpenAI: { chat: { completions: { create: jest.Mock } } };
  let generator: QuestionGenerator;

  beforeEach(() => {
    mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    };
    generator = new QuestionGenerator(mockOpenAI as never);
  });

  it('should generate a NEED layer question for INTEREST intent', async () => {
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              content: 'What specific outcome are you hoping to achieve?',
              rationale: 'Exploring the core need',
            }),
          },
        },
      ],
    });

    const result = await generator.generate(Intent.INTEREST, makeContext());

    expect(result.layer).toBe(QuestionLayer.NEED);
    expect(result.content).toBe('What specific outcome are you hoping to achieve?');
    expect(result.rationale).toBe('Exploring the core need');
  });

  it('should generate an OBJECTION layer question for OBJECTION intent', async () => {
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              content: 'Could you tell me more about your concern with the price?',
              rationale: 'Addressing objection',
            }),
          },
        },
      ],
    });

    const result = await generator.generate(Intent.OBJECTION, makeContext());

    expect(result.layer).toBe(QuestionLayer.OBJECTION);
  });

  it('should generate a CONFIRMATION layer question for CONFIRMATION intent', async () => {
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              content: 'Would you be open to scheduling a demo?',
              rationale: 'Closing move',
            }),
          },
        },
      ],
    });

    const result = await generator.generate(Intent.CONFIRMATION, makeContext());

    expect(result.layer).toBe(QuestionLayer.CONFIRMATION);
  });

  it('should return fallback question on OpenAI error', async () => {
    mockOpenAI.chat.completions.create.mockRejectedValue(new Error('Network error'));

    const result = await generator.generate(Intent.INTEREST, makeContext());

    expect(result.layer).toBe(QuestionLayer.NEED);
    expect(result.content).toBeTruthy();
    expect(result.rationale).toContain('Fallback');
  });

  it('should use cache when available', async () => {
    const { cacheGet } = jest.requireMock('../../utils/cache');
    (cacheGet as jest.Mock).mockResolvedValueOnce({
      layer: QuestionLayer.NEED,
      content: 'Cached question?',
      rationale: 'Cached rationale',
    });

    const result = await generator.generate(Intent.INTEREST, makeContext());

    expect(result.content).toBe('Cached question?');
    expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
  });
});
