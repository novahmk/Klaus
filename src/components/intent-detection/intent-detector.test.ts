// ============================================================
// UNIT TESTS — Intent Detection
// ============================================================

import { IntentDetector } from './intent-detector';
import { Intent, ConversationContext } from '../../types';

// Mock dependencies
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
  leadId: 'lead-123',
  history: [],
  currentIntent: Intent.UNKNOWN,
  score: 0,
  metadata: {},
  ...overrides,
});

describe('IntentDetector', () => {
  let mockOpenAI: { chat: { completions: { create: jest.Mock } } };
  let detector: IntentDetector;

  beforeEach(() => {
    mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    };
    detector = new IntentDetector(mockOpenAI as never);
  });

  it('should detect INTEREST intent', async () => {
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              intent: 'INTEREST',
              confidence: 0.9,
              justification: 'Lead expressed enthusiasm',
            }),
          },
        },
      ],
    });

    const result = await detector.detect('I want to learn more!', makeContext());

    expect(result.intent).toBe(Intent.INTEREST);
    expect(result.confidence).toBe(0.9);
    expect(result.justification).toBe('Lead expressed enthusiasm');
  });

  it('should detect OBJECTION intent', async () => {
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              intent: 'OBJECTION',
              confidence: 0.85,
              justification: 'Price concern raised',
            }),
          },
        },
      ],
    });

    const result = await detector.detect('This seems too expensive', makeContext());

    expect(result.intent).toBe(Intent.OBJECTION);
    expect(result.confidence).toBe(0.85);
  });

  it('should return UNKNOWN on OpenAI error', async () => {
    mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API timeout'));

    const result = await detector.detect('some message', makeContext());

    expect(result.intent).toBe(Intent.UNKNOWN);
    expect(result.confidence).toBe(0);
  });

  it('should return UNKNOWN for unrecognized intent string', async () => {
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              intent: 'FOOBAR',
              confidence: 0.5,
              justification: 'Some reason',
            }),
          },
        },
      ],
    });

    const result = await detector.detect('message', makeContext());

    expect(result.intent).toBe(Intent.UNKNOWN);
  });

  it('should clamp confidence to [0, 1]', async () => {
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              intent: 'INTEREST',
              confidence: 1.5,
              justification: 'test',
            }),
          },
        },
      ],
    });

    const result = await detector.detect('message', makeContext());

    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('should return cached result without calling OpenAI', async () => {
    const { cacheGet } = jest.requireMock('../../utils/cache');
    (cacheGet as jest.Mock).mockResolvedValueOnce({
      intent: Intent.CONFIRMATION,
      confidence: 0.95,
      justification: 'Cached result',
    });

    const result = await detector.detect('cached message', makeContext());

    expect(result.intent).toBe(Intent.CONFIRMATION);
    expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
  });
});
