// ============================================================
// GLOBAL TYPES — Klaus V2
// ============================================================

// ------ Enums -----------------------------------------------

export enum Intent {
  INTEREST = 'INTEREST',
  OBJECTION = 'OBJECTION',
  QUESTION = 'QUESTION',
  CONFIRMATION = 'CONFIRMATION',
  DISQUALIFICATION = 'DISQUALIFICATION',
  UNKNOWN = 'UNKNOWN',
}

export enum QuestionLayer {
  NEED = 'NEED',
  OBJECTION = 'OBJECTION',
  CONFIRMATION = 'CONFIRMATION',
}

export enum KnowledgeSource {
  CLIENT_BASE = 'CLIENT_BASE',
  CUSTOM_OBJECTIONS = 'CUSTOM_OBJECTIONS',
  GENERIC_BASE = 'GENERIC_BASE',
}

export enum LeadStatus {
  NEW = 'NEW',
  IN_PROGRESS = 'IN_PROGRESS',
  QUALIFIED = 'QUALIFIED',
  DISQUALIFIED = 'DISQUALIFIED',
  TRANSFERRED = 'TRANSFERRED',
}

export enum HandoffTrigger {
  SCORE_THRESHOLD = 'SCORE_THRESHOLD',
  EXPLICIT_REQUEST = 'EXPLICIT_REQUEST',
  MANUAL = 'MANUAL',
}

// ------ Core data structures --------------------------------

export interface Lead {
  id: string;
  externalId?: string;
  name?: string;
  email?: string;
  phone?: string;
  status: LeadStatus;
  score: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  leadId: string;
  content: string;
  role: 'user' | 'assistant';
  intent?: Intent;
  embedding?: number[];
  timestamp: Date;
}

export interface ConversationContext {
  leadId: string;
  history: Message[];
  currentIntent: Intent;
  score: number;
  metadata: Record<string, unknown>;
}

// ------ Component results ------------------------------------

export interface IntentDetectionResult {
  intent: Intent;
  confidence: number;
  justification: string;
}

export interface GeneratedQuestion {
  layer: QuestionLayer;
  content: string;
  rationale: string;
}

export interface KnowledgeEntry {
  id: string;
  source: KnowledgeSource;
  content: string;
  embedding: number[];
  score?: number;
  metadata: Record<string, unknown>;
}

export interface RankedResponse {
  content: string;
  score: number;
  source: KnowledgeSource | 'GPT';
  metadata: Record<string, unknown>;
}

export interface QualificationResult {
  score: number;
  shouldHandoff: boolean;
  trigger?: HandoffTrigger;
  justification: string;
}

export interface OrchestratorResult {
  response: string;
  intent: Intent;
  qualificationScore: number;
  shouldHandoff: boolean;
  updatedLead: Lead;
}

// ------ Queue job payloads -----------------------------------

export interface IncomingMessageJob {
  jobId: string;
  leadId: string;
  message: string;
  clientId: string;
  timestamp: string;
}

export interface HandoffJob {
  jobId: string;
  leadId: string;
  score: number;
  trigger: HandoffTrigger;
  timestamp: string;
}

// ------ Config -----------------------------------------------

export interface KlausConfig {
  openai: {
    apiKey: string;
    model: string;
    embeddingModel: string;
  };
  postgres: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  qualification: {
    handoffThreshold: number;
  };
}
