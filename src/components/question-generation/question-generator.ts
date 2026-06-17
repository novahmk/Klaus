// ============================================================
// COMPONENT 2 — Question Generation
// ============================================================

import OpenAI from 'openai';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { cacheGet, cacheSet, buildCacheKey } from '../../utils/cache';
import {
  Intent,
  QuestionLayer,
  GeneratedQuestion,
  ConversationContext,
} from '../../types';

const CACHE_TTL = 600; // 10 minutes
const CACHE_PREFIX = 'question';

const LAYER_FOR_INTENT: Record<Intent, QuestionLayer> = {
  [Intent.INTEREST]: QuestionLayer.NEED,
  [Intent.QUESTION]: QuestionLayer.NEED,
  [Intent.OBJECTION]: QuestionLayer.OBJECTION,
  [Intent.CONFIRMATION]: QuestionLayer.CONFIRMATION,
  [Intent.DISQUALIFICATION]: QuestionLayer.CONFIRMATION,
  [Intent.UNKNOWN]: QuestionLayer.NEED,
};

const LAYER_INSTRUCTIONS: Record<QuestionLayer, string> = {
  [QuestionLayer.NEED]: `Generate a single, natural question that discovers what the lead truly needs.
Focus on understanding their pain points, goals, and urgency.
Keep it conversational and open-ended.`,
  [QuestionLayer.OBJECTION]: `Generate a single, empathetic question that acknowledges the lead's concern
and gently explores the root cause of their objection.
Do not argue or push — just understand.`,
  [QuestionLayer.CONFIRMATION]: `Generate a single closing or confirmation question that helps move
the conversation forward. Assess readiness to take the next step
or transition to a human sales representative.`,
};

export class QuestionGenerator {
  private readonly openai: OpenAI;

  constructor(openaiClient?: OpenAI) {
    this.openai = openaiClient ?? new OpenAI({ apiKey: config.openai.apiKey });
  }

  /**
   * Selects the appropriate question layer and generates a contextual question.
   */
  async generate(
    intent: Intent,
    context: ConversationContext,
  ): Promise<GeneratedQuestion> {
    const layer = LAYER_FOR_INTENT[intent] ?? QuestionLayer.NEED;
    const cacheKey = this.buildCacheKey(intent, layer, context);

    const cached = await cacheGet<GeneratedQuestion>(cacheKey);
    if (cached) {
      logger.info('Question cache hit', { leadId: context.leadId, layer });
      return cached;
    }

    logger.info('Generating question', { leadId: context.leadId, intent, layer });

    try {
      const question = await this.callOpenAI(layer, context);
      await cacheSet(cacheKey, question, CACHE_TTL);
      logger.info('Question generated', { leadId: context.leadId, layer });
      return question;
    } catch (err) {
      logger.error('Question generation failed, using fallback', {
        leadId: context.leadId,
        error: (err as Error).message,
      });
      return this.fallbackQuestion(layer);
    }
  }

  private async callOpenAI(
    layer: QuestionLayer,
    context: ConversationContext,
  ): Promise<GeneratedQuestion> {
    const historySnippet = context.history
      .slice(-6)
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    const layerInstruction = LAYER_INSTRUCTIONS[layer];

    const systemPrompt = `You are Klaus, an AI sales development representative.
${layerInstruction}
Respond with valid JSON only:
{
  "content": "<the question to ask>",
  "rationale": "<why this question is appropriate now>"
}`;

    const userPrompt = `Conversation history:\n${historySnippet}\n\nCurrent lead score: ${context.score}/10.
Generate the most appropriate ${layer} question.`;

    const completion = await this.openai.chat.completions.create({
      model: config.openai.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw) as { content: string; rationale: string };

    return {
      layer,
      content: String(parsed.content ?? ''),
      rationale: String(parsed.rationale ?? ''),
    };
  }

  private fallbackQuestion(layer: QuestionLayer): GeneratedQuestion {
    const fallbacks: Record<QuestionLayer, string> = {
      [QuestionLayer.NEED]: 'Could you tell me more about what you are looking for?',
      [QuestionLayer.OBJECTION]: 'Could you help me understand your main concern?',
      [QuestionLayer.CONFIRMATION]:
        'Would you be open to speaking with one of our specialists?',
    };
    return {
      layer,
      content: fallbacks[layer],
      rationale: 'Fallback question due to service unavailability.',
    };
  }

  private buildCacheKey(
    intent: Intent,
    layer: QuestionLayer,
    context: ConversationContext,
  ): string {
    const recentMessages = context.history
      .slice(-2)
      .map((m) => m.content)
      .join('|');
    const hash = Buffer.from(`${intent}:${layer}:${recentMessages}`)
      .toString('base64')
      .slice(0, 20);
    return buildCacheKey(CACHE_PREFIX, context.leadId, hash);
  }
}
