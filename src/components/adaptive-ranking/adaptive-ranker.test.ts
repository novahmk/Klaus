// ============================================================
// UNIT TESTS — Adaptive Ranking
// ============================================================

import { AdaptiveRanker } from './adaptive-ranker';
import { KnowledgeEntry, KnowledgeSource, Intent, ConversationContext } from '../../types';

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
  leadId: 'lead-789',
  history: [],
  currentIntent: Intent.UNKNOWN,
  score: 3,
  metadata: {},
  ...overrides,
});

const makeEntry = (overrides?: Partial<KnowledgeEntry>): KnowledgeEntry => ({
  id: 'entry-1',
  source: KnowledgeSource.GENERIC_BASE,
  content: 'Our product helps businesses grow.',
  embedding: [],
  score: 0.8,
  metadata: { effectiveness: 0.7 },
  ...overrides,
});

describe('AdaptiveRanker', () => {
  let ranker: AdaptiveRanker;

  beforeEach(() => {
    ranker = new AdaptiveRanker();
  });

  it('should return empty array when no entries provided', async () => {
    const result = await ranker.rank([], makeContext());
    expect(result).toEqual([]);
  });

  it('should rank entries by composite score', async () => {
    const entries: KnowledgeEntry[] = [
      makeEntry({
        id: 'e1',
        score: 0.6,
        metadata: { effectiveness: 0.3 },
      }),
      makeEntry({
        id: 'e2',
        score: 0.9,
        metadata: { effectiveness: 0.9 },
      }),
    ];

    const result = await ranker.rank(entries, makeContext());

    expect(result).toHaveLength(2);
    expect(result[0].score).toBeGreaterThan(result[1].score);
    expect(result[0].metadata['entryId']).toBe('e2');
  });

  it('should include entry metadata in ranked response', async () => {
    const entries: KnowledgeEntry[] = [
      makeEntry({ id: 'e1', content: 'Test response', source: KnowledgeSource.CLIENT_BASE }),
    ];

    const result = await ranker.rank(entries, makeContext());

    expect(result[0].content).toBe('Test response');
    expect(result[0].source).toBe(KnowledgeSource.CLIENT_BASE);
    expect(result[0].metadata['entryId']).toBe('e1');
  });

  it('should score between 0 and 1', async () => {
    const entries: KnowledgeEntry[] = [
      makeEntry({ score: 1.0, metadata: { effectiveness: 1.0 } }),
    ];

    const result = await ranker.rank(entries, makeContext());

    expect(result[0].score).toBeGreaterThanOrEqual(0);
    expect(result[0].score).toBeLessThanOrEqual(1);
  });

  it('should boost context-relevant entries', async () => {
    const context = makeContext({
      history: [
        {
          id: 'm1',
          leadId: 'lead-789',
          content: 'I am interested in pricing',
          role: 'user',
          timestamp: new Date(),
        },
      ],
    });

    const relevantEntry = makeEntry({
      id: 'e1',
      content: 'Our pricing is competitive and flexible',
      score: 0.75,
      metadata: { effectiveness: 0.5 },
    });

    const irrelevantEntry = makeEntry({
      id: 'e2',
      content: 'We offer great support',
      score: 0.75,
      metadata: { effectiveness: 0.5 },
    });

    const result = await ranker.rank([relevantEntry, irrelevantEntry], context);

    // The relevant entry should rank higher due to context score
    expect(result[0].metadata['entryId']).toBe('e1');
  });
});
