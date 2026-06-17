// ============================================================
// COMPONENT 4 — Adaptive Ranking
// ============================================================

import { logger } from '../../utils/logger';
import { cacheGet, cacheSet, buildCacheKey } from '../../utils/cache';
import { KnowledgeEntry, RankedResponse, ConversationContext } from '../../types';
import { createHash } from 'crypto';

const CACHE_TTL = 60; // 1 minute
const CACHE_PREFIX = 'ranking';

// Weights for scoring
const WEIGHTS = {
  similarity: 0.40,
  effectiveness: 0.30,
  recency: 0.15,
  context: 0.15,
};

export class AdaptiveRanker {
  /**
   * Ranks knowledge entries by relevance, effectiveness, context, and recency.
   * Returns the best ordered list of responses.
   */
  async rank(
    entries: KnowledgeEntry[],
    context: ConversationContext,
  ): Promise<RankedResponse[]> {
    if (entries.length === 0) {
      logger.info('No entries to rank', { leadId: context.leadId });
      return [];
    }

    const cacheKey = this.buildCacheKey(entries, context);
    const cached = await cacheGet<RankedResponse[]>(cacheKey);
    if (cached) {
      logger.info('Ranking cache hit', { leadId: context.leadId });
      return cached;
    }

    logger.info('Ranking knowledge entries', {
      leadId: context.leadId,
      count: entries.length,
    });

    const scored = entries.map((entry) => ({
      entry,
      score: this.computeScore(entry, context),
    }));

    scored.sort((a, b) => b.score - a.score);

    const ranked: RankedResponse[] = scored.map(({ entry, score }) => ({
      content: entry.content,
      score,
      source: entry.source,
      metadata: {
        entryId: entry.id,
        originalScore: entry.score ?? 0,
        ...entry.metadata,
      },
    }));

    await cacheSet(cacheKey, ranked, CACHE_TTL);

    logger.info('Ranking complete', {
      leadId: context.leadId,
      topScore: ranked[0]?.score ?? 0,
    });

    return ranked;
  }

  private computeScore(entry: KnowledgeEntry, context: ConversationContext): number {
    const similarity = entry.score ?? 0; // cosine similarity [0,1]

    const effectiveness = this.normalizeEffectiveness(
      (entry.metadata['effectiveness'] as number) ?? 0,
    );

    const recency = this.computeRecency(entry.metadata['updated_at'] as string | undefined);

    const contextScore = this.computeContextScore(entry, context);

    return (
      WEIGHTS.similarity * similarity +
      WEIGHTS.effectiveness * effectiveness +
      WEIGHTS.recency * recency +
      WEIGHTS.context * contextScore
    );
  }

  private normalizeEffectiveness(raw: number): number {
    // Effectiveness is stored as 0.0 to 1.0
    return Math.min(1, Math.max(0, raw));
  }

  private computeRecency(updatedAt: string | undefined): number {
    if (!updatedAt) return 0.5;
    const ageMs = Date.now() - new Date(updatedAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    // Decays from 1 to 0 over 90 days
    return Math.max(0, 1 - ageDays / 90);
  }

  private computeContextScore(entry: KnowledgeEntry, context: ConversationContext): number {
    // Boost score if source matches current conversation needs
    const intentKeywords = context.history
      .slice(-3)
      .flatMap((m) => m.content.toLowerCase().split(/\s+/));
    const entryWords = entry.content.toLowerCase().split(/\s+/);
    const overlap = entryWords.filter((w) => intentKeywords.includes(w)).length;
    return Math.min(1, overlap / 10);
  }

  private buildCacheKey(entries: KnowledgeEntry[], context: ConversationContext): string {
    const ids = entries.map((e) => e.id).join(',');
    const hash = createHash('sha256').update(ids).digest('hex').slice(0, 16);
    return buildCacheKey(CACHE_PREFIX, context.leadId, hash);
  }
}
