// ============================================================
// UNIT TESTS — Orchestrator
// ============================================================

import { Orchestrator } from './orchestrator';
import {
  Intent,
  LeadStatus,
  IncomingMessageJob,
  QualificationResult,
  IntentDetectionResult,
  GeneratedQuestion,
  QuestionLayer,
  RankedResponse,
  KnowledgeSource,
  Lead,
} from '../../types';

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../utils/cache', () => ({
  cacheGet: jest.fn().mockResolvedValue(null),
  cacheSet: jest.fn().mockResolvedValue(undefined),
  cacheDel: jest.fn().mockResolvedValue(undefined),
  buildCacheKey: (...parts: string[]) => parts.join(':'),
}));

const mockLead: Lead = {
  id: 'lead-orch-1',
  status: LeadStatus.IN_PROGRESS,
  score: 5,
  metadata: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

jest.mock('../../db/connection', () => ({
  query: jest.fn().mockImplementation((sql: string) => {
    if (sql.includes('SELECT * FROM leads')) return Promise.resolve([{
      id: 'lead-orch-1',
      external_id: null,
      name: null,
      email: null,
      phone: null,
      status: 'IN_PROGRESS',
      score: 5,
      metadata: {},
      created_at: new Date(),
      updated_at: new Date(),
    }]);
    if (sql.includes('SELECT id, lead_id')) return Promise.resolve([]);
    return Promise.resolve([]);
  }),
  withTransaction: jest.fn().mockImplementation(async (fn: (client: unknown) => Promise<Lead>) => {
    const fakeClient = {
      query: jest.fn().mockImplementation((sql: string) => {
        if (sql.includes('UPDATE leads')) {
          return Promise.resolve({
            rows: [{
              id: 'lead-orch-1',
              external_id: null,
              name: null,
              email: null,
              phone: null,
              status: 'IN_PROGRESS',
              score: 7,
              metadata: {},
              created_at: new Date(),
              updated_at: new Date(),
            }],
          });
        }
        return Promise.resolve({ rows: [] });
      }),
    };
    return fn(fakeClient);
  }),
}));

const makeJob = (overrides?: Partial<IncomingMessageJob>): IncomingMessageJob => ({
  jobId: 'job-1',
  leadId: 'lead-orch-1',
  message: 'I am interested in your product',
  clientId: 'client-1',
  timestamp: new Date().toISOString(),
  ...overrides,
});

describe('Orchestrator', () => {
  let mockIntentDetector: { detect: jest.Mock };
  let mockQuestionGenerator: { generate: jest.Mock };
  let mockKnowledgeSearcher: { search: jest.Mock };
  let mockAdaptiveRanker: { rank: jest.Mock };
  let mockResponseGenerator: { generate: jest.Mock };
  let mockQualifier: { qualify: jest.Mock; computeStatusFromIntent: jest.Mock };
  let orchestrator: Orchestrator;

  const intentResult: IntentDetectionResult = {
    intent: Intent.INTEREST,
    confidence: 0.9,
    justification: 'Clear interest expressed',
  };

  const questionResult: GeneratedQuestion = {
    layer: QuestionLayer.NEED,
    content: 'What are your main goals?',
    rationale: 'Explore need',
  };

  const qualResult: QualificationResult = {
    score: 7,
    shouldHandoff: false,
    justification: 'Good prospect',
  };

  beforeEach(() => {
    mockIntentDetector = { detect: jest.fn().mockResolvedValue(intentResult) };
    mockQuestionGenerator = { generate: jest.fn().mockResolvedValue(questionResult) };
    mockKnowledgeSearcher = { search: jest.fn().mockResolvedValue([]) };
    mockAdaptiveRanker = { rank: jest.fn().mockResolvedValue([]) };
    mockResponseGenerator = {
      generate: jest.fn().mockResolvedValue('Thank you for your interest!'),
    };
    mockQualifier = {
      qualify: jest.fn().mockResolvedValue(qualResult),
      computeStatusFromIntent: jest.fn().mockReturnValue(LeadStatus.IN_PROGRESS),
    };

    orchestrator = new Orchestrator(
      mockIntentDetector as never,
      mockQuestionGenerator as never,
      mockKnowledgeSearcher as never,
      mockAdaptiveRanker as never,
      mockResponseGenerator as never,
      mockQualifier as never,
    );
  });

  it('should process an incoming message end-to-end', async () => {
    const result = await orchestrator.process(makeJob());

    expect(result.intent).toBe(Intent.INTEREST);
    expect(result.qualificationScore).toBe(7);
    expect(result.shouldHandoff).toBe(false);
    expect(result.response).toBeTruthy();
  });

  it('should call all components in the correct order', async () => {
    const callOrder: string[] = [];

    mockIntentDetector.detect.mockImplementation(async () => {
      callOrder.push('intent');
      return intentResult;
    });
    mockQuestionGenerator.generate.mockImplementation(async () => {
      callOrder.push('question');
      return questionResult;
    });
    mockKnowledgeSearcher.search.mockImplementation(async () => {
      callOrder.push('knowledge');
      return [];
    });
    mockAdaptiveRanker.rank.mockImplementation(async () => {
      callOrder.push('ranking');
      return [];
    });
    mockResponseGenerator.generate.mockImplementation(async () => {
      callOrder.push('response');
      return 'Generated response';
    });
    mockQualifier.qualify.mockImplementation(async () => {
      callOrder.push('qualification');
      return qualResult;
    });

    await orchestrator.process(makeJob());

    expect(callOrder).toEqual([
      'intent',
      'question',
      'knowledge',
      'ranking',
      'response',
      'qualification',
    ]);
  });

  it('should use knowledge base response when score is high enough', async () => {
    const rankedResponses: RankedResponse[] = [
      {
        content: 'Knowledge base answer',
        score: 0.9,
        source: KnowledgeSource.CLIENT_BASE,
        metadata: {},
      },
    ];

    mockAdaptiveRanker.rank.mockResolvedValue(rankedResponses);

    const result = await orchestrator.process(makeJob());

    expect(mockResponseGenerator.generate).not.toHaveBeenCalled();
    expect(result.response).toContain('Knowledge base answer');
  });

  it('should fall back to GPT when knowledge base score is too low', async () => {
    const lowScoreResponses: RankedResponse[] = [
      {
        content: 'Low relevance answer',
        score: 0.5,
        source: KnowledgeSource.GENERIC_BASE,
        metadata: {},
      },
    ];

    mockAdaptiveRanker.rank.mockResolvedValue(lowScoreResponses);

    await orchestrator.process(makeJob());

    expect(mockResponseGenerator.generate).toHaveBeenCalled();
  });

  it('should indicate handoff when qualifier says so', async () => {
    mockQualifier.qualify.mockResolvedValue({
      score: 9,
      shouldHandoff: true,
      justification: 'Ready for sales',
    });

    const result = await orchestrator.process(makeJob());

    expect(result.shouldHandoff).toBe(true);
  });
});
