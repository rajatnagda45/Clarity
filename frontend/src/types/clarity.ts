export type RiskFlag = 'normal' | 'non_standard' | 'flagged';
export type Role = 'owner' | 'editor' | 'viewer';
export type EntailmentLabel = 'entail' | 'neutral' | 'contradict';
export type SourceType = 'pdf' | 'docx' | 'url';
export type DocumentStatus =
  | 'uploaded'
  | 'extracted'
  | 'normalized'
  | 'metadata_ready'
  | 'awaiting_chunking'
  | 'chunking'
  | 'chunked'
  | 'awaiting_embeddings'
  | 'embedding'
  | 'embedded'
  | 'awaiting_index'
  | 'indexing'
  | 'indexed'
  | 'failed';
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
  role: Role;
  plan: Plan;
}

export interface MeResponse {
  userId: string;
  workspaces: Workspace[];
}

export interface Document {
  id: string;
  filename: string;
  sourceType: SourceType;
  pageCount: number | null;
  status: DocumentStatus;
  error: string | null;
  createdAt: string;
}

export interface DocumentDetail extends Document {
  clauses: Clause[];
}

export interface DocumentFile {
  documentId: string;
  filename: string;
  signedUrl: string;
  expiresInSeconds: number;
}

export interface ChunkSourceOffset {
  page: number;
  blockOrder: number;
  charStart: number;
  charEnd: number;
}

export interface DocumentChunk {
  chunkId: string;
  chunkIndex: number;
  sectionTitle: string | null;
  clauseNumber: string | null;
  pageStart: number;
  pageEnd: number;
  sourceOffsets: ChunkSourceOffset[];
  tokenCount: number;
  checksum: string;
  parserVersion: string;
  chunkVersion: string;
  chunkKind: string;
  fragmentIndex: number;
  fragmentCount: number;
  crossReferences: string[];
  text: string;
}

export interface DocumentEmbedding {
  chunkId: string;
  chunkIndex: number;
  status: 'current' | 'stale';
  embeddingProvider: string;
  embeddingModel: string;
  embeddingDimension: number;
  embeddingVersion: string;
  parserVersion: string;
  chunkVersion: string;
  checksum: string;
  tokenCount: number;
  latencyMs: number | null;
  retryCount: number;
  estimatedCostUsd: number;
  vectorPreview: number[];
  createdAt: string;
}

export interface DocumentEmbeddingInspector {
  documentId: string;
  currentEmbeddingProvider: string | null;
  currentEmbeddingModel: string | null;
  currentEmbeddingDimension: number | null;
  currentEmbeddingVersion: string | null;
  currentEmbeddingParserVersion: string | null;
  currentEmbeddingChunkVersion: string | null;
  embeddings: DocumentEmbedding[];
}

export interface EmbeddingMetrics {
  documentsProcessed: number;
  chunksProcessed: number;
  averageChunksPerDocument: number;
  averageTokensPerChunk: number;
  averageEmbeddingLatencyMs: number;
  processingSuccessRate: number;
  processingFailureRate: number;
  retryCount: number;
  averageDocumentProcessingTimeMs: number;
  averageEmbeddingQueueTimeMs: number;
  estimatedTotalTokens: number;
  estimatedTotalCostUsd: number;
  providerUsageCounts: Record<string, number>;
  modelUsageCounts: Record<string, number>;
}

export interface DocumentVectorIndex {
  chunkId: string;
  chunkIndex: number;
  chunkText: string;
  vectorId: string;
  namespace: string;
  status: 'current' | 'stale';
  indexProvider: string;
  indexName: string;
  embeddingProvider: string;
  embeddingModel: string;
  embeddingDimension: number;
  embeddingVersion: string;
  parserVersion: string;
  chunkVersion: string;
  checksum: string;
  sectionTitle: string | null;
  clauseNumber: string | null;
  pageStart: number;
  pageEnd: number;
  retryCount: number;
  latencyMs: number | null;
  indexedAt: string | null;
}

export interface DocumentVectorIndexInspector {
  documentId: string;
  currentIndexProvider: string | null;
  currentIndexName: string | null;
  currentIndexNamespace: string | null;
  vectors: DocumentVectorIndex[];
}

export interface IndexMetrics {
  vectorsIndexed: number;
  averageIndexingLatencyMs: number;
  indexThroughput: number;
  failedIndexOperations: number;
  retryCount: number;
  namespaceCounts: Record<string, number>;
  indexSizeEstimateBytes: number;
  synchronizationLagMs: number;
  currentEmbeddingVersionCoverage: number;
  indexedDocuments: number;
  averageDocumentIndexingTimeMs: number;
  indexedDimensions: number;
}

export interface RetrievalFilters {
  sectionTitle?: string;
  clauseNumber?: string;
  pageStart?: number;
  pageEnd?: number;
  chunkKind?: string;
}

export interface RetrievalEvidence {
  workspaceId: string;
  documentId: string;
  chunkId: string;
  chunkIndex: number;
  text: string;
  sectionTitle: string | null;
  clauseNumber: string | null;
  pageStart: number;
  pageEnd: number;
  chunkKind: string;
  crossReferences: string[];
  vectorScore: number | null;
  bm25Score: number | null;
  rrfScore: number;
  rerankScore: number | null;
  finalScore: number;
  finalRank: number;
  retrievalReason: string;
  retrievalSources: Array<'dense' | 'sparse' | 'cross_reference'>;
  parserVersion: string;
  chunkVersion: string;
  embeddingVersion: string | null;
}

export interface RetrievalStageEntry {
  chunkId: string;
  documentId: string;
  rank: number;
  score: number;
  reason: string | null;
}

export interface RetrievalNormalizedQuery {
  rawQuery: string;
  normalizedQuery: string;
  tokens: string[];
  clauseRefs: string[];
  quotedPhrases: string[];
}

export interface RetrievalResponse {
  normalizedQuery: RetrievalNormalizedQuery;
  retrievalMode: string;
  cacheHit: boolean;
  results: RetrievalEvidence[];
}

export interface RetrievalExplorerResponse {
  normalizedQuery: RetrievalNormalizedQuery;
  cacheHit: boolean;
  denseCandidates: RetrievalStageEntry[];
  sparseCandidates: RetrievalStageEntry[];
  fusedCandidates: RetrievalStageEntry[];
  results: RetrievalEvidence[];
  denseLatencyMs: number;
  sparseLatencyMs: number;
  fusionLatencyMs: number;
  totalLatencyMs: number;
}

export interface RetrievalMetrics {
  retrievalLatencyMs: number;
  averageRetrievedChunks: number;
  denseRecall: number;
  sparseRecall: number;
  fusionLatencyMs: number;
  averageFusionScore: number;
  filterUsage: number;
  queryVolume: number;
  retrievalCacheHits: number;
  retrievalFailures: number;
}

export interface DeveloperDashboardDocument {
  id: string;
  filename: string;
  status: DocumentStatus;
  sourceType: SourceType;
  createdAt: string;
  error: string | null;
  embeddingQueuedAt: string | null;
  embeddingStartedAt: string | null;
  embeddingCompletedAt: string | null;
  indexQueuedAt: string | null;
  indexStartedAt: string | null;
  indexCompletedAt: string | null;
}

export interface DeveloperDashboard {
  documents: DeveloperDashboardDocument[];
  statusCounts: Record<string, number>;
  failedJobs: DeveloperDashboardDocument[];
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
  citationKeys: string[];
  section?: string | null;
  verificationPass: number;
  supported: boolean;           // true only if Critic AND NLI entailment agree
  uncertain: boolean;
  criticStatus?: 'supported' | 'partial' | 'unsupported';
  criticNote?: string | null;
  correctedText?: string | null;
  entailmentLabel?: EntailmentLabel;
  entailmentScore?: number;     // 0..1
  supportProbability?: number;
  contradictionProbability?: number;
  confidence?: number;          // 0..1, calibrated per-claim
}

export interface TrustScore {
  faithfulness: number;         // 0..1
  relevance: number | null;
  overall: number;
  confidence: number;           // 0..1, calibrated
  calibrated: boolean;
  confidenceBand: 'low' | 'medium' | 'high';
}

export interface Abstention {
  reason: string;
  missingEvidenceQuery?: string;
  suggestedFollowUp?: string;
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
  answerRunId?: string | null;
  retrievalRunId?: string | null;
  citations: Citation[];
}

export interface Conversation {
  id: string;
  workspaceId: string;
  title?: string | null;
  createdAt: string;
  lastMessageAt: string;
  messageCount: number;
}

export interface Citation {
  citationKey: string;
  documentId: string;
  chunkId: string;
  sectionTitle?: string | null;
  clauseNumber?: string | null;
  pageStart: number;
  pageEnd: number;
  checksum?: string | null;
  sourceOffsets: ChunkSourceOffset[];
}

// SSE event union — every event the backend can emit on the query stream
export type StreamEvent =
  | {
      type: 'meta';
      conversationId: string;
      userMessageId: string;
      assistantMessageId?: string;
      retrievalRunId: string;
      answerRunId: string;
    }
  | { type: 'graph_node'; node: string; status: 'started' | 'finished'; summary?: string }
  | { type: 'retrieval'; normalizedQuery: RetrievalNormalizedQuery; resultCount: number }
  | { type: 'token'; text: string }
  | { type: 'claim'; claim: Claim }
  | { type: 'debate_turn'; round: number; actor: 'writer' | 'critic'; action: DebateTurn['action']; claimId?: string; note?: string }
  | { type: 'trust'; score: TrustScore }
  | ({ type: 'abstention' } & Abstention & { trust?: TrustScore })
  | { type: 'citation'; citation: Citation }
  | { type: 'message'; message: Message }
  | { type: 'error'; code: string; message: string }
  | { type: 'done' };

export interface ConversationDetail {
  conversation: Conversation;
  messages: Message[];
}

export interface AnswerMetrics {
  conversationsCreated: number;
  messagesCreated: number;
  answerFailures: number;
  answerLatencyMs: number;
  firstTokenLatencyMs: number;
  streamingDurationMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  averageCitationsPerAnswer: number;
  averageEvidenceChunksPerAnswer: number;
}

export interface AnswerExplorerRun {
  answerRunId: string;
  conversationId: string;
  retrievalRunId: string;
  userMessageId: string;
  assistantMessageId?: string | null;
  query: string;
  normalizedQuery: string;
  provider: string;
  model: string;
  promptVersion: string;
  writerVersion: string;
  status: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  latencyMs?: number | null;
  firstTokenLatencyMs?: number | null;
  retryCount: number;
  createdAt: string;
  completedAt?: string | null;
  promptPayload: Record<string, unknown>;
  finalAnswer?: string | null;
  citations: Citation[];
  retrievedEvidence: RetrievalEvidence[];
  streamEvents: StreamEvent[];
}

export interface AnswerExplorerResponse {
  runs: AnswerExplorerRun[];
}

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
  error?: string | { code?: string; message?: string };
  detail?: string | { code?: string; message?: string };
}
