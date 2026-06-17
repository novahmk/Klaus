// ============================================================
// COMPONENT 6 — Lead Qualification
// ============================================================

import OpenAI from 'openai';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { cacheGet, cacheSet, buildCacheKey } from '../../utils/cache';
import { query } from '../../db/connection';
import {
  Intent,
  QualificationResult,
  HandoffTrigger,
  ConversationContext,
  Lead,
  LeadStatus,
} from '../../types';
import { createHash } from 'crypto';

const CACHE_TTL = 60; // 1 minute
const CACHE_PREFIX = 'qualification';

interface QualificationRow {
  id: string;
  lead_id: string;
  score: number;
  justification: string;
  handoff: boolean;
  trigger: string | null;
  created_at: Date;
}

export class Qualifier {
  private readonly openai: OpenAI;
  private readonly handoffThreshold: number;

  constructor(openaiClient?: OpenAI, handoffThreshold?: number) {
    this.openai = openaiClient ?? new OpenAI({ apiKey: config.openai.apiKey });
    this.handoffThreshold = handoffThreshold ?? config.qualification.handoffThreshold;
  }

  /**
   * Computes a lead qualification score (1–10) and determines if handoff is needed.
   */
  async qualify(
    lead: Lead,
    context: ConversationContext,
  ): Promise<QualificationResult> {
    const cacheKey = this.buildCacheKey(lead.id, context);
    const cached = await cacheGet<QualificationResult>(cacheKey);
    if (cached) {
      logger.info('Qualification cache hit', { leadId: lead.id, score: cached.score });
      return cached;
    }

    logger.info('Qualifying lead', { leadId: lead.id, currentScore: lead.score });

    try {
      const result = await this.computeScore(lead, context);
      await cacheSet(cacheKey, result, CACHE_TTL);
      await this.persistResult(lead.id, result);

      logger.info('Lead qualified', {
        leadId: lead.id,
        score: result.score,
        shouldHandoff: result.shouldHandoff,
      });

      return result;
    } catch (err) {
      logger.error('Qualification failed', {
        leadId: lead.id,
        error: (err as Error).message,
      });
      // Return current score without handoff as safe fallback
      return {
        score: lead.score,
        shouldHandoff: false,
        justification: 'Qualification failed — maintaining current score.',
      };
    }
  }

  private async computeScore(
    lead: Lead,
    context: ConversationContext,
  ): Promise<QualificationResult> {
    const historySnippet = context.history
      .slice(-10)
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    const intents = context.history
      .filter((m) => m.intent)
      .map((m) => m.intent);

    const systemPrompt = `You are a lead qualification AI for a sales team.
Analyze the conversation and produce a lead quality score from 1 to 10.

Scoring criteria:
- 1–3: Not interested or clearly unqualified.
- 4–6: Some interest but significant objections or unclear fit.
- 7–9: Good fit with manageable objections.
- 10: Highly qualified, ready for immediate sales contact.

Respond with valid JSON only:
{
  "score": <1 to 10>,
  "justification": "<brief reasoning>",
  "shouldHandoff": <true|false>
}`;

    const userPrompt = `Lead status: ${lead.status}
Current score: ${lead.score}/10
Detected intents: ${intents.join(', ') || 'none'}
Conversation:\n${historySnippet}`;

    const completion = await this.openai.chat.completions.create({
      model: config.openai.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw) as {
      score: number;
      justification: string;
      shouldHandoff: boolean;
    };

    const score = Math.min(10, Math.max(1, Math.round(Number(parsed.score) || 1)));
    const shouldHandoff = score >= this.handoffThreshold || Boolean(parsed.shouldHandoff);
    const trigger = shouldHandoff ? HandoffTrigger.SCORE_THRESHOLD : undefined;

    return {
      score,
      shouldHandoff,
      trigger,
      justification: String(parsed.justification ?? ''),
    };
  }

  /**
   * Updates lead status based on intent signals without calling OpenAI.
   */
  computeStatusFromIntent(currentStatus: LeadStatus, intent: Intent): LeadStatus {
    if (intent === Intent.DISQUALIFICATION) return LeadStatus.DISQUALIFIED;
    if (currentStatus === LeadStatus.NEW) return LeadStatus.IN_PROGRESS;
    return currentStatus;
  }

  private async persistResult(leadId: string, result: QualificationResult): Promise<void> {
    try {
      await query(
        `INSERT INTO qualification_history (lead_id, score, justification, handoff, trigger)
         VALUES ($1, $2, $3, $4, $5)`,
        [leadId, result.score, result.justification, result.shouldHandoff, result.trigger ?? null],
      );
    } catch (err) {
      logger.warn('Failed to persist qualification result', {
        leadId,
        error: (err as Error).message,
      });
    }
  }

  private buildCacheKey(leadId: string, context: ConversationContext): string {
    const lastMessageId = context.history[context.history.length - 1]?.id ?? 'none';
    const hash = createHash('sha256').update(lastMessageId).digest('hex').slice(0, 16);
    return buildCacheKey(CACHE_PREFIX, leadId, hash);
  }
}
