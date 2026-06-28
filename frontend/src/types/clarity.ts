export type RiskFlag = 'normal' | 'non_standard' | 'flagged';
export type Role = 'owner' | 'editor' | 'viewer';
export type EntailmentLabel = 'entail' | 'neutral' | 'contradict';
export type SourceType = 'pdf' | 'docx' | 'url';
export type DocumentStatus = 'processing' | 'ready' | 'failed';
export type Plan = 'free' | 'pro' | 'team';
export type ClauseType =
  | 'termination'
  | 'renewal'
  | 'liability'
  | 'payment'
  | 'ip'
  | 'confidentiality'
  | 'other';

export interface Workspace {
  id: string;
  name: string;
  ownerUserId: string;
  plan: Plan;
  createdAt: string;
}

export interface Document {
  id: string;
  workspaceId: string;
  filename: string;
  sourceType: SourceType;
  r2Key: string;
  pageCount: number | null;
  status: DocumentStatus;
  error: string | null;
  createdAt: string;
}

export interface SpanRef {
  chunkId: string;
  documentId: string;
  page: number;
  charStart: number;
  charEnd: number;
  text: string;
  rerankScore: number;
}

export interface BoundingBox {
  page: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Claim {
  id: string;
  text: string;
  spanIds: string[];
  supported: boolean;           // true only if Critic AND NLI entailment agree
  uncertain: boolean;
  entailmentLabel?: EntailmentLabel;
  entailmentScore?: number;     // 0..1
  confidence?: number;          // 0..1, calibrated per-claim
}

export interface TrustScore {
  faithfulness: number;         // 0..1
  relevance: number;
  overall: number;
  confidence: number;           // 0..1, calibrated
  calibrated: boolean;
}

export interface Abstention {
  reason: string;
  missingEvidenceQuery?: string;
}

export interface DebateTurn {
  round: number;                // 0 | 1 | 2
  actor: 'writer' | 'critic';
  action: 'draft' | 'flag' | 'revise' | 'reretrieve' | 'resolve';
  claimId?: string;
  note?: string;
}

export interface Contradiction {
  id: string;
  topic: string;
  positions: { documentId: string; value: string; spanId?: string }[];
  severity: 'minor' | 'major';
  note?: string;
}

export interface Clause {
  id: string;
  workspaceId: string;
  documentId: string;
  clauseType: ClauseType;
  text: string;
  page: number;
  riskFlag: RiskFlag;
  rationale?: string;
  benchmarkMatchId?: string;
  deviationNote?: string;
  riskScore?: number;
  createdAt: string;
}

export interface Message {
  id: string;
  workspaceId: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  claims?: Claim[];
  trustScore?: TrustScore;
  abstention?: Abstention;
}

export interface Conversation {
  id: string;
  workspaceId: string;
  title?: string;
  createdAt: string;
}

// SSE event union — every event the backend can emit on the query stream
export type StreamEvent =
  | { type: 'meta'; conversationId: string; messageId: string }
  | { type: 'graph_node'; node: string; status: 'started' | 'finished'; summary?: string }
  | { type: 'debate_turn'; round: number; actor: 'writer' | 'critic'; action: string; claimId?: string; note?: string }
  | { type: 'token'; claimId: string; text: string }
  | { type: 'claim'; claim: Claim }
  | { type: 'trust'; score: TrustScore }
  | { type: 'abstention'; abstention: Abstention }
  | { type: 'done' };

export interface EvalMetrics {
  faithfulness: number;
  relevance: number;
  contextPrecision: number;
  contextRecall: number;
  catchRate?: number;
  calibrationEce?: number;
  casesTotal: number;
  suite: 'golden' | 'adversarial';
  commitSha?: string;
  createdAt: string;
}

export interface ApiError {
  error: string;
  detail?: string;
}
