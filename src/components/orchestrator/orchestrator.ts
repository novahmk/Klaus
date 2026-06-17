// ============================================================
// COMPONENT 7 — Orchestrator
// ============================================================

import { logger } from '../../utils/logger';
import { query, withTransaction } from '../../db/connection';
import { cacheGet, cacheSet, cacheDel, buildCacheKey } from '../../utils/cache';
import { IntentDetector } from '../intent-detection';
import { QuestionGenerator } from '../question-generation';
import { KnowledgeSearcher } from '../knowledge-search';
import { AdaptiveRanker } from '../adaptive-ranking';
import { ResponseGenerator } from '../response-generation';
import { Qualifier } from '../qualification';
import {
  Lead,
  Message,
  ConversationContext,
  Intent,
  LeadStatus,
  OrchestratorResult,
  IncomingMessageJob,
} from '../../types';
import { randomUUID } from 'crypto';

const CONTEXT_CACHE_TTL = 1800; // 30 minutes
const CONTEXT_CACHE_PREFIX = 'context';

interface LeadRow {
  id: string;
  external_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  score: number;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

interface MessageRow {
  id: string;
  lead_id: string;
  content: string;
  role: string;
  intent: string | null;
  timestamp: Date;
}

export class Orchestrator {
  private readonly intentDetector: IntentDetector;
  private readonly questionGenerator: QuestionGenerator;
  private readonly knowledgeSearcher: KnowledgeSearcher;
  private readonly adaptiveRanker: AdaptiveRanker;
  private readonly responseGenerator: ResponseGenerator;
  private readonly qualifier: Qualifier;

  constructor(
    intentDetector?: IntentDetector,
    questionGenerator?: QuestionGenerator,
    knowledgeSearcher?: KnowledgeSearcher,
    adaptiveRanker?: AdaptiveRanker,
    responseGenerator?: ResponseGenerator,
    qualifier?: Qualifier,
  ) {
    this.intentDetector = intentDetector ?? new IntentDetector();
    this.questionGenerator = questionGenerator ?? new QuestionGenerator();
    this.knowledgeSearcher = knowledgeSearcher ?? new KnowledgeSearcher();
    this.adaptiveRanker = adaptiveRanker ?? new AdaptiveRanker();
    this.responseGenerator = responseGenerator ?? new ResponseGenerator();
    this.qualifier = qualifier ?? new Qualifier();
  }

  /**
   * Main entry point. Coordinates all components to process an incoming message.
   * No flow occurs without passing through the orchestrator.
   */
  async process(job: IncomingMessageJob): Promise<OrchestratorResult> {
    const { leadId, message, clientId } = job;

    logger.info('Orchestrator processing message', { leadId, clientId });

    // 1. Load lead and conversation context
    const lead = await this.getOrCreateLead(leadId);
    const context = await this.loadContext(lead);

    // 2. Detect intent
    const intentResult = await this.intentDetector.detect(message, context);
    context.currentIntent = intentResult.intent;

    // 3. Generate question
    const nextQuestion = await this.questionGenerator.generate(
      intentResult.intent,
      context,
    );

    // 4. Search knowledge base
    const knowledgeEntries = await this.knowledgeSearcher.search(
      message,
      clientId,
      context,
    );

    // 5. Rank available responses
    const rankedResponses = await this.adaptiveRanker.rank(knowledgeEntries, context);

    // 6. Choose final response
    let responseText: string;
    if (rankedResponses.length > 0 && rankedResponses[0].score >= 0.7) {
      responseText = rankedResponses[0].content;
      // Append the follow-up question naturally
      if (nextQuestion.content) {
        responseText = `${responseText}\n\n${nextQuestion.content}`;
      }
      logger.info('Using knowledge base response', {
        leadId,
        score: rankedResponses[0].score,
        source: rankedResponses[0].source,
      });
    } else {
      // Fallback to GPT generation
      responseText = await this.responseGenerator.generate(
        message,
        intentResult.intent,
        context,
        nextQuestion,
      );
    }

    // 7. Qualify the lead
    const updatedStatus = this.qualifier.computeStatusFromIntent(
      lead.status,
      intentResult.intent,
    );
    const qualificationResult = await this.qualifier.qualify(
      { ...lead, status: updatedStatus },
      context,
    );

    // 8. Persist and update
    const updatedLead = await this.persistInteraction(
      lead,
      message,
      responseText,
      intentResult.intent,
      qualificationResult.score,
      updatedStatus,
    );

    // 9. Invalidate context cache to force reload on next interaction
    await cacheDel(buildCacheKey(CONTEXT_CACHE_PREFIX, leadId));

    logger.info('Orchestrator complete', {
      leadId,
      intent: intentResult.intent,
      score: qualificationResult.score,
      shouldHandoff: qualificationResult.shouldHandoff,
    });

    return {
      response: responseText,
      intent: intentResult.intent,
      qualificationScore: qualificationResult.score,
      shouldHandoff: qualificationResult.shouldHandoff,
      updatedLead,
    };
  }

  private async getOrCreateLead(leadId: string): Promise<Lead> {
    const rows = await query<LeadRow>(
      'SELECT * FROM leads WHERE id = $1',
      [leadId],
    );

    if (rows.length > 0) {
      return this.rowToLead(rows[0]);
    }

    logger.info('Creating new lead', { leadId });
    const created = await query<LeadRow>(
      `INSERT INTO leads (id, status, score, metadata)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [leadId, LeadStatus.NEW, 0, {}],
    );
    return this.rowToLead(created[0]);
  }

  private async loadContext(lead: Lead): Promise<ConversationContext> {
    const cacheKey = buildCacheKey(CONTEXT_CACHE_PREFIX, lead.id);
    const cached = await cacheGet<ConversationContext>(cacheKey);
    if (cached) {
      return cached;
    }

    const messageRows = await query<MessageRow>(
      `SELECT id, lead_id, content, role, intent, timestamp
       FROM messages
       WHERE lead_id = $1
       ORDER BY timestamp ASC
       LIMIT 50`,
      [lead.id],
    );

    const history: Message[] = messageRows.map((r) => ({
      id: r.id,
      leadId: r.lead_id,
      content: r.content,
      role: r.role as 'user' | 'assistant',
      intent: r.intent as Intent | undefined,
      timestamp: r.timestamp,
    }));

    const context: ConversationContext = {
      leadId: lead.id,
      history,
      currentIntent: Intent.UNKNOWN,
      score: lead.score,
      metadata: lead.metadata,
    };

    await cacheSet(cacheKey, context, CONTEXT_CACHE_TTL);
    return context;
  }

  private async persistInteraction(
    lead: Lead,
    userMessage: string,
    assistantResponse: string,
    intent: Intent,
    newScore: number,
    newStatus: LeadStatus,
  ): Promise<Lead> {
    return withTransaction(async (client) => {
      // Insert user message
      await client.query(
        `INSERT INTO messages (id, lead_id, content, role, intent)
         VALUES ($1, $2, $3, 'user', $4)`,
        [randomUUID(), lead.id, userMessage, intent],
      );

      // Insert assistant response
      await client.query(
        `INSERT INTO messages (id, lead_id, content, role)
         VALUES ($1, $2, $3, 'assistant')`,
        [randomUUID(), lead.id, assistantResponse],
      );

      // Update lead score and status
      const updated = await client.query<LeadRow>(
        `UPDATE leads
         SET score = $1, status = $2, updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [newScore, newStatus, lead.id],
      );

      return this.rowToLead(updated.rows[0]);
    });
  }

  private rowToLead(row: LeadRow): Lead {
    return {
      id: row.id,
      externalId: row.external_id ?? undefined,
      name: row.name ?? undefined,
      email: row.email ?? undefined,
      phone: row.phone ?? undefined,
      status: row.status as LeadStatus,
      score: row.score,
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
