// ============================================================
// COMPONENT 1 — Intent Detection
// ============================================================

import OpenAI from 'openai';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { cacheGet, cacheSet, buildCacheKey } from '../../utils/cache';
import { Intent, IntentDetectionResult, ConversationContext } from '../../types';
import { createHash } from 'crypto';

const CACHE_TTL = 300; // 5 minutes
const CACHE_PREFIX = 'intent';

export class IntentDetector {
  private readonly openai: OpenAI;

  constructor(openaiClient?: OpenAI) {
    this.openai = openaiClient ?? new OpenAI({ apiKey: config.openai.apiKey });
  }

  /**
   * Detects the intent behind the user message, using cache when possible.
   */
  async detect(
    message: string,
    context: ConversationContext,
  ): Promise<IntentDetectionResult> {
    const cacheKey = this.buildCacheKey(message, context);

    const cached = await cacheGet<IntentDetectionResult>(cacheKey);
    if (cached) {
      logger.info('Intent cache hit', { leadId: context.leadId, intent: cached.intent });
      return cached;
    }

    logger.info('Detecting intent', { leadId: context.leadId, messageLength: message.length });

    try {
      const result = await this.callOpenAI(message, context);
      await cacheSet(cacheKey, result, CACHE_TTL);
      logger.info('Intent detected', {
        leadId: context.leadId,
        intent: result.intent,
        confidence: result.confidence,
      });
      return result;
    } catch (err) {
      logger.error('Intent detection failed, returning UNKNOWN', {
        leadId: context.leadId,
        error: (err as Error).message,
      });
      return {
        intent: Intent.UNKNOWN,
        confidence: 0,
        justification: 'Detection failed due to service error.',
      };
    }
  }

  private async callOpenAI(
    message: string,
    context: ConversationContext,
  ): Promise<IntentDetectionResult> {
    const historySnippet = context.history
      .slice(-6)
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    const systemPrompt = `You are an intent classifier for a sales AI assistant called Klaus.
Classify the user message into one of these intents:
- INTEREST: The lead is showing interest in the product/service.
- OBJECTION: The lead is raising a concern, doubt, or barrier.
- QUESTION: The lead is asking for information.
- CONFIRMATION: The lead is agreeing or confirming readiness.
- DISQUALIFICATION: The lead is clearly not a fit or wants to stop.
- UNKNOWN: None of the above.

Respond with valid JSON only:
{
  "intent": "<INTENT>",
  "confidence": <0.0 to 1.0>,
  "justification": "<brief reason>"
}`;

    const userPrompt = `Conversation history:\n${historySnippet}\n\nNew message: "${message}"`;

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
      intent: string;
      confidence: number;
      justification: string;
    };

    const intent = this.parseIntent(parsed.intent);
    const confidence = Math.min(1, Math.max(0, Number(parsed.confidence) || 0));

    return {
      intent,
      confidence,
      justification: String(parsed.justification ?? ''),
    };
  }

  private parseIntent(raw: string): Intent {
    const upper = String(raw).toUpperCase();
    if (Object.values(Intent).includes(upper as Intent)) {
      return upper as Intent;
    }
    return Intent.UNKNOWN;
  }

  private buildCacheKey(message: string, context: ConversationContext): string {
    const hash = createHash('sha256')
      .update(message + context.currentIntent)
      .digest('hex')
      .slice(0, 16);
    return buildCacheKey(CACHE_PREFIX, context.leadId, hash);
  }
}
