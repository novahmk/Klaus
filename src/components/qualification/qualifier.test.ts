// ============================================================
// UNIT TESTS — Qualification
// ============================================================

import { Qualifier } from './qualifier';
import { Intent, Lead, LeadStatus, ConversationContext, HandoffTrigger } from '../../types';

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

jest.mock('../../db/connection', () => ({
  query: jest.fn().mockResolvedValue([]),
}));

const makeLead = (overrides?: Partial<Lead>): Lead => ({
  id: 'lead-q1',
  status: LeadStatus.IN_PROGRESS,
  score: 5,
  metadata: {},
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeContext = (overrides?: Partial<ConversationContext>): ConversationContext => ({
  leadId: 'lead-q1',
  history: [],
  currentIntent: Intent.INTEREST,
  score: 5,
  metadata: {},
  ...overrides,
});

describe('Qualifier', () => {
  let mockOpenAI: { chat: { completions: { create: jest.Mock } } };
  let qualifier: Qualifier;

  beforeEach(() => {
    mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    };
    qualifier = new Qualifier(mockOpenAI as never, 8);
  });

  it('should qualify a lead with score 9 and trigger handoff', async () => {
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              score: 9,
              justification: 'High interest, budget confirmed',
              shouldHandoff: false,
            }),
          },
        },
      ],
    });

    const result = await qualifier.qualify(makeLead(), makeContext());

    expect(result.score).toBe(9);
    expect(result.shouldHandoff).toBe(true);
    expect(result.trigger).toBe(HandoffTrigger.SCORE_THRESHOLD);
  });

  it('should not trigger handoff below threshold', async () => {
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              score: 5,
              justification: 'Moderate interest',
              shouldHandoff: false,
            }),
          },
        },
      ],
    });

    const result = await qualifier.qualify(makeLead(), makeContext());

    expect(result.score).toBe(5);
    expect(result.shouldHandoff).toBe(false);
  });

  it('should clamp score to [1, 10]', async () => {
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              score: 15,
              justification: 'Over the top',
              shouldHandoff: false,
            }),
          },
        },
      ],
    });

    const result = await qualifier.qualify(makeLead(), makeContext());

    expect(result.score).toBeLessThanOrEqual(10);
    expect(result.score).toBeGreaterThanOrEqual(1);
  });

  it('should return safe fallback on OpenAI error', async () => {
    mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API error'));

    const lead = makeLead({ score: 4 });
    const result = await qualifier.qualify(lead, makeContext());

    expect(result.score).toBe(4);
    expect(result.shouldHandoff).toBe(false);
  });

  describe('computeStatusFromIntent', () => {
    it('should disqualify on DISQUALIFICATION intent', () => {
      const result = qualifier.computeStatusFromIntent(
        LeadStatus.IN_PROGRESS,
        Intent.DISQUALIFICATION,
      );
      expect(result).toBe(LeadStatus.DISQUALIFIED);
    });

    it('should move NEW lead to IN_PROGRESS', () => {
      const result = qualifier.computeStatusFromIntent(
        LeadStatus.NEW,
        Intent.INTEREST,
      );
      expect(result).toBe(LeadStatus.IN_PROGRESS);
    });

    it('should keep existing status for non-triggering intents', () => {
      const result = qualifier.computeStatusFromIntent(
        LeadStatus.IN_PROGRESS,
        Intent.QUESTION,
      );
      expect(result).toBe(LeadStatus.IN_PROGRESS);
    });
  });
});
