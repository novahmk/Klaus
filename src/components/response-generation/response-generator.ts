// ============================================================
// COMPONENT 5 — Response Generation (GPT fallback)
// ============================================================

import OpenAI from 'openai';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { Intent, ConversationContext, GeneratedQuestion } from '../../types';

// Security rules applied to every generated response
const SECURITY_RULES = `IMPORTANT RULES:
- Never promise specific pricing without approval.
- Never make commitments that require managerial sign-off.
- Never share competitor's confidential information.
- Never discuss internal company matters.
- Always stay on topic related to sales qualification.
- Never reveal that you are an AI unless directly and explicitly asked.
- Keep responses concise (under 150 words).`;

export class ResponseGenerator {
  private readonly openai: OpenAI;

  constructor(openaiClient?: OpenAI) {
    this.openai = openaiClient ?? new OpenAI({ apiKey: config.openai.apiKey });
  }

  /**
   * Generates a response using GPT.
   * This component is executed ONLY when the knowledge base has no adequate answer.
   */
  async generate(
    message: string,
    intent: Intent,
    context: ConversationContext,
    nextQuestion?: GeneratedQuestion,
  ): Promise<string> {
    logger.info('Generating GPT response', {
      leadId: context.leadId,
      intent,
      hasQuestion: !!nextQuestion,
    });

    try {
      const response = await this.callOpenAI(message, intent, context, nextQuestion);
      logger.info('GPT response generated', { leadId: context.leadId });
      return response;
    } catch (err) {
      logger.error('Response generation failed, returning fallback', {
        leadId: context.leadId,
        error: (err as Error).message,
      });
      return this.getFallbackResponse(intent);
    }
  }

  private async callOpenAI(
    message: string,
    intent: Intent,
    context: ConversationContext,
    nextQuestion?: GeneratedQuestion,
  ): Promise<string> {
    const historyMessages = context.history.slice(-10).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const systemPrompt = `You are Klaus, an intelligent AI Sales Development Representative.
Your goal is to qualify leads through natural, adaptive conversation.
Current lead score: ${context.score}/10.
Detected intent: ${intent}.
${nextQuestion ? `After your response, naturally include this follow-up question: "${nextQuestion.content}"` : ''}

${SECURITY_RULES}`;

    const completion = await this.openai.chat.completions.create({
      model: config.openai.model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...historyMessages,
        { role: 'user', content: message },
      ],
      temperature: 0.6,
      max_tokens: 300,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('Empty response from OpenAI');
    return content.trim();
  }

  private getFallbackResponse(intent: Intent): string {
    const fallbacks: Record<Intent, string> = {
      [Intent.INTEREST]:
        'Thank you for your interest! Could you tell me a bit more about what you are looking for?',
      [Intent.OBJECTION]:
        'I understand your concern. Could you share more details so I can better help you?',
      [Intent.QUESTION]:
        'Great question! Let me connect you with someone who can answer that precisely.',
      [Intent.CONFIRMATION]:
        'I appreciate your time. Let me arrange the next steps for you.',
      [Intent.DISQUALIFICATION]:
        'I completely understand. If anything changes, feel free to reach out.',
      [Intent.UNKNOWN]:
        'Thank you for your message. Could you share a bit more so I can assist you better?',
    };
    return fallbacks[intent];
  }
}
