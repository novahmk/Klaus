// ============================================================
// COMPONENT 3 — Knowledge Search
// ============================================================

import OpenAI from 'openai';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { cacheGet, cacheSet, buildCacheKey } from '../../utils/cache';
import { query } from '../../db/connection';
import { KnowledgeEntry, KnowledgeSource, ConversationContext } from '../../types';
import { createHash } from 'crypto';

const CACHE_TTL = 120; // 2 minutes
const CACHE_PREFIX = 'knowledge';
const SIMILARITY_THRESHOLD = 0.75;
const MAX_RESULTS = 5;

interface KnowledgeRow {
  id: string;
  client_id: string;
  source: string;
  content: string;
  embedding: number[];
  effectiveness: number;
  usage_count: number;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  similarity: number;
}

export class KnowledgeSearcher {
  private readonly openai: OpenAI;

  constructor(openaiClient?: OpenAI) {
    this.openai = openaiClient ?? new OpenAI({ apiKey: config.openai.apiKey });
  }

  /**
   * Searches the knowledge base in priority order:
   * 1. Client-specific base
   * 2. Custom objections
   * 3. Generic base
   */
  async search(
    message: string,
    clientId: string,
    context: ConversationContext,
  ): Promise<KnowledgeEntry[]> {
    const cacheKey = this.buildCacheKey(message, clientId);

    const cached = await cacheGet<KnowledgeEntry[]>(cacheKey);
    if (cached) {
      logger.info('Knowledge cache hit', { leadId: context.leadId, clientId, count: cached.length });
      return cached;
    }

    logger.info('Searching knowledge base', { leadId: context.leadId, clientId });

    try {
      const embedding = await this.generateEmbedding(message);
      const results = await this.searchByPriority(embedding, clientId);
      await cacheSet(cacheKey, results, CACHE_TTL);

      logger.info('Knowledge search complete', {
        leadId: context.leadId,
        count: results.length,
      });
      return results;
    } catch (err) {
      logger.error('Knowledge search failed', {
        leadId: context.leadId,
        error: (err as Error).message,
      });
      return [];
    }
  }

  private async searchByPriority(
    embedding: number[],
    clientId: string,
  ): Promise<KnowledgeEntry[]> {
    const embeddingStr = `[${embedding.join(',')}]`;

    // Query ordered by source priority then similarity
    const rows = await query<KnowledgeRow>(
      `SELECT *,
         1 - (embedding <=> $1::vector) AS similarity,
         CASE source
           WHEN $2 THEN 1
           WHEN $3 THEN 2
           WHEN $4 THEN 3
           ELSE 4
         END AS source_priority
       FROM knowledge_entries
       WHERE client_id = $5
         AND (1 - (embedding <=> $1::vector)) >= $6
       ORDER BY source_priority ASC, similarity DESC
       LIMIT $7`,
      [
        embeddingStr,
        KnowledgeSource.CLIENT_BASE,
        KnowledgeSource.CUSTOM_OBJECTIONS,
        KnowledgeSource.GENERIC_BASE,
        clientId,
        SIMILARITY_THRESHOLD,
        MAX_RESULTS,
      ],
    );

    return rows.map((row) => ({
      id: row.id,
      source: row.source as KnowledgeSource,
      content: row.content,
      embedding: row.embedding,
      score: row.similarity,
      metadata: row.metadata ?? {},
    }));
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: config.openai.embeddingModel,
      input: text,
    });
    return response.data[0]?.embedding ?? [];
  }

  private buildCacheKey(message: string, clientId: string): string {
    const hash = createHash('sha256')
      .update(message)
      .digest('hex')
      .slice(0, 16);
    return buildCacheKey(CACHE_PREFIX, clientId, hash);
  }
}
