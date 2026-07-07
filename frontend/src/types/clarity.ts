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
  totalStorageBytes?: number;
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
  text: string;                 // claim_text in DB
  criticVerdict: string;        // supported | unsupported | uncertain
  nliLabel?: EntailmentLabel | null;
  nliScore?: number | null;     // 0..1
  ensembleVerdict: string;      // supported | unsupported | uncertain
  evidenceSpans: string[];
  debateTurn: number;
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
  missingEvidenceQuery?: string | null;
  suggestedFollowUp?: string | null;
}

export interface DebateTurn {
  turn: number;
  claim: string;
  verdict: string;
  reasoning: string;
  createdAt?: string | null;
}

export interface Contradiction {
  id: string;
  topic: string;
  docA: string;
  spanA?: string | null;
  valueA?: string | null;
  docB: string;
  spanB?: string | null;
  valueB?: string | null;
  severity: 'minor' | 'major';
  note?: string | null;
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
  trust?: TrustScore | null;
  abstention?: Abstention | null;
  claims?: Claim[];
  debateTurns?: DebateTurn[];
  retrievedEvidence?: RetrievalEvidence[];
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
  | {
      type: 'claim';
      claim: string;
      verdict: 'supported' | 'unsupported' | 'uncertain';
      criticVerdict: string;
      nliLabel: string;
      nliScore: number;
      evidenceSpans: string[];
    }
  | {
      type: 'debate_turn';
      turn: number;
      claim: string;
      verdict: 'supported' | 'unsupported' | 'uncertain';
      reasoning: string;
    }
  | {
      type: 'trust';
      raw: number;
      calibrated: number;
      components: Record<string, number>;
    }
  | {
      type: 'abstention';
      reason: string;
      trustScore: number;
      threshold: number;
      missingEvidenceQuery?: string;
    }
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
  trust?: TrustScore | null;
  abstention?: Abstention | null;
  claims: Claim[];
  debateTurns: DebateTurn[];
  citations: Citation[];
  retrievedEvidence: RetrievalEvidence[];
  streamEvents: Array<StreamEvent | Record<string, unknown>>;
}

export interface AnswerExplorerResponse {
  runs: AnswerExplorerRun[];
}

export interface EvalMetrics {
  faithfulness: number | null;
  relevance: number | null;
  contextPrecision: number | null;
  contextRecall: number | null;
  catchRate?: number | null;
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

// ─── B4: Quality Improvement Platform types ──────────────────────────────────

export interface ExperimentCandidate {
  id: string;
  workspaceId: string;
  experimentId: string;
  name: string;
  promptVersion: string;
  modelVersion: string;
  writerVersion: string;
  avgJudgeOverall: number | null;
  avgTrustConfidence: number | null;
  evalCount: number;
  createdAt: string;
}

export interface Experiment {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  status: 'active' | 'completed' | 'archived';
  winnerCandidateId: string | null;
  candidates: ExperimentCandidate[];
  createdAt: string;
}

export interface ExperimentListResponse {
  experiments: Experiment[];
  total: number;
}

export interface PromptVersion {
  id: string;
  workspaceId: string;
  promptKey: string;
  version: string;
  description: string | null;
  content: string;
  author: string | null;
  active: boolean;
  retired: boolean;
  createdAt: string;
}

export interface PromptVersionListResponse {
  versions: PromptVersion[];
  total: number;
}

export interface OptimizationRecommendation {
  id: string;
  workspaceId: string;
  dimension: string;
  severity: 'low' | 'medium' | 'high';
  recommendation: string;
  evidence: Record<string, unknown> | null;
  status: 'pending' | 'accepted' | 'dismissed';
  resolvedAt: string | null;
  createdAt: string;
}

export interface OptimizationListResponse {
  recommendations: OptimizationRecommendation[];
  total: number;
}

export interface QualityGateRule {
  id: string;
  workspaceId: string;
  name: string;
  metric: string;
  operator: string;
  threshold: number;
  active: boolean;
  createdAt: string;
}

export interface QualityGateRunDetail {
  ruleId: string;
  ruleName: string;
  metric: string;
  passed: boolean;
  note: string;
}

export interface QualityGateRun {
  id: string;
  workspaceId: string;
  benchmarkRunId: string | null;
  experimentId: string | null;
  rulesEvaluated: number;
  rulesPassed: number;
  rulesFailed: number;
  passed: boolean;
  details: QualityGateRunDetail[];
  createdAt: string;
}

export interface QualityGateRunListResponse {
  runs: QualityGateRun[];
  total: number;
}

export interface ReleaseNote {
  id: string;
  workspaceId: string;
  title: string;
  fromVersion: string | null;
  toVersion: string;
  summary: string;
  metricsDelta: Record<string, number>;
  benchmarkRunId: string | null;
  createdAt: string;
}

export interface ReleaseNoteListResponse {
  notes: ReleaseNote[];
  total: number;
}

export interface BenchmarkSuggestion {
  id: string;
  workspaceId: string;
  answerRunId: string | null;
  question: string;
  suggestedReason: string;
  status: 'pending' | 'approved' | 'dismissed';
  approvedCaseId: string | null;
  createdAt: string;
}

export interface BenchmarkSuggestionListResponse {
  suggestions: BenchmarkSuggestion[];
  total: number;
}

export interface ModelComparison {
  modelVersion: string;
  runCount: number;
  totalCases: number;
  avgJudgeOverall: number | null;
  avgTrustConfidence: number | null;
  avgLatencyMs: number | null;
}

export interface ModelComparisonListResponse {
  comparisons: ModelComparison[];
  total: number;
}

// ---------------------------------------------------------------------------
// Member management
// ---------------------------------------------------------------------------

export interface WorkspaceMember {
  userId: string;
  role: Role;
  joinedAt: string | null;
}

export interface MembersListResponse {
  members: WorkspaceMember[];
  total: number;
}

// ---------------------------------------------------------------------------
// Observability
// ---------------------------------------------------------------------------

export interface HealthProbeResult {
  ok: boolean;
  latency_ms: number | null;
  detail: string | null;
}

export interface SystemHealth {
  status: "ready" | "degraded" | "unavailable";
  version: string;
  environment: string;
  checks: Record<string, HealthProbeResult>;
}

export interface EndpointMetric {
  count: number;
  total_ms: number;
  errors: number;
}

export interface LiveMetrics {
  uptime_seconds: number;
  request_count: number;
  error_count: number;
  avg_latency_ms: number;
  active_requests: number;
  endpoints: Record<string, EndpointMetric>;
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

export interface Collection {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  documentCount: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface CollectionDetail extends Collection {
  documents: Document[];
}

export interface CollectionListResponse {
  collections: Collection[];
  total: number;
}

export interface CreateCollectionPayload {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

export interface UpdateCollectionPayload {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
}

// ─── Phase 11 — Benchmark & Evaluation Analytics types ────────────────────────

export type DatasetType = 'contract_qa' | 'lease_qa' | 'policy_qa' | 'custom';
export type BenchmarkRunStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export interface BenchmarkDataset {
  id: string;
  workspaceId: string;
  name: string;
  datasetType: DatasetType;
  description: string | null;
  createdAt: string;
}

export interface BenchmarkDatasetDetail extends BenchmarkDataset {
  caseCount: number;
  runCount: number;
}

export interface BenchmarkCase {
  id: string;
  workspaceId: string;
  datasetId: string;
  question: string;
  referenceAnswer: string | null;
  documentIds: string[];
  createdAt: string;
}

export interface BenchmarkRun {
  id: string;
  workspaceId: string;
  datasetId: string;
  status: BenchmarkRunStatus;
  totalCases: number;
  completedCases: number;
  failedCases: number;
  avgJudgeOverall: number | null;
  avgTrustConfidence: number | null;
  avgLatencyMs: number | null;
  createdAt: string;
}

export interface BenchmarkRunDetail extends BenchmarkRun {
  promptVersion: string | null;
  modelVersion: string | null;
  writerVersion: string | null;
  totalCostUsd: number | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface BenchmarkImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export interface CreateBenchmarkDatasetPayload {
  name: string;
  datasetType: DatasetType;
  description?: string;
}

export interface CreateBenchmarkCasePayload {
  question: string;
  referenceAnswer?: string;
  documentIds?: string[];
}

export interface JudgeScores {
  faithfulness: number | null;
  grounding: number | null;
  completeness: number | null;
  correctness: number | null;
  clarity: number | null;
  citationQuality: number | null;
  hallucinationRisk: number | null;
  overall: number;
  reasoning: string | null;
}

export interface EvalRun {
  id: string;
  workspaceId: string;
  answerRunId: string | null;
  judgeProvider: string | null;
  judgeModel: string | null;
  judgePromptVersion: string | null;
  judgeLatencyMs: number | null;
  scores: JudgeScores | null;
  createdAt: string;
}

export interface EvalRunListResponse {
  evaluations: EvalRun[];
  total: number;
}

export interface QualityRollup {
  id: string;
  workspaceId: string;
  day: string;
  avgFaithfulness: number | null;
  abstentionRate: number;
  n: number;
  avgJudgeOverall: number | null;
  avgHallucinationRisk: number | null;
  avgConfidenceScore: number | null;
  abstentionCount: number;
  verificationPassCount: number;
  totalAnswers: number;
}

export interface QualityDashboard {
  rollups: QualityRollup[];
  days: number;
}

export interface RegressionReport {
  id: string;
  workspaceId: string;
  currentEvalId: string;
  windowSize: number;
  baselineAvgJudgeOverall: number | null;
  currentJudgeOverall: number | null;
  judgeOverallDelta: number | null;
  hasRegression: boolean;
  regressionFlags: string[];
  createdAt: string;
}

export interface RegressionListResponse {
  reports: RegressionReport[];
  total: number;
}

export interface CitationQualityBucket {
  range: string;
  count: number;
}

export interface TopCitedDocument {
  documentId: string;
  citationCount: number;
}

export interface CitationAnalytics {
  totalCitations: number;
  answersWithCitations: number;
  answersWithoutCitations: number;
  avgCitationsPerAnswer: number;
  avgCitationQualityScore: number | null;
  citationQualityDistribution: CitationQualityBucket[];
  topCitedDocuments: TopCitedDocument[];
}

export interface TrustVerdictBreakdown {
  supported: number;
  unsupported: number;
  contradicted: number;
  unknown: number;
}

export interface TrustBandBreakdown {
  high: number;
  medium: number;
  low: number;
}

export interface TrustHistogramBucket {
  bucket: string;
  count: number;
}

export interface TrustAnalytics {
  totalAnswers: number;
  avgTrustOverall: number | null;
  avgTrustFaithfulness: number | null;
  avgTrustConfidence: number | null;
  abstentionCount: number;
  abstentionRate: number;
  verdictBreakdown: TrustVerdictBreakdown;
  confidenceBandBreakdown: TrustBandBreakdown;
  trustHistogram: TrustHistogramBucket[];
}

export interface ConversationEvalSummary {
  conversationId: string;
  messageCount: number;
  avgJudgeOverall: number | null;
  avgTrustOverall: number | null;
  avgHallucinationRisk: number | null;
  avgCitationQuality: number | null;
  abstentionCount: number;
  createdAt: string;
}

export interface ConversationEvalListResponse {
  conversations: ConversationEvalSummary[];
  total: number;
}

// ─── Phase 12 — Enterprise types ──────────────────────────────────────────────

export interface ApiKey {
  id: string;
  workspaceId: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface ApiKeyCreated extends ApiKey {
  plaintextKey: string;
}

export interface ApiKeyListResponse {
  keys: ApiKey[];
  total: number;
}

export interface CreateApiKeyPayload {
  name: string;
  scopes?: string[];
  expiresInDays?: number;
}

export interface Webhook {
  id: string;
  workspaceId: string;
  url: string;
  events: string[];
  description: string | null;
  enabled: boolean;
  secretPreview?: string | null;
  createdAt: string;
}

export interface WebhookListResponse {
  webhooks: Webhook[];
  total: number;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  workspaceId: string;
  eventType: string;
  status: 'success' | 'failure' | 'pending';
  responseCode: number | null;
  latencyMs: number | null;
  error: string | null;
  createdAt: string;
}

export interface WebhookDeliveryListResponse {
  deliveries: WebhookDelivery[];
  total: number;
}

export interface CreateWebhookPayload {
  url: string;
  events: string[];
  description?: string;
}

export interface AuditLog {
  id: string;
  workspaceId: string;
  userId: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  severity: 'info' | 'warning' | 'critical';
  createdAt: string;
}

export interface AuditLogListResponse {
  logs: AuditLog[];
  total: number;
}

export interface AuditLogFilters {
  action?: string;
  userId?: string;
  resourceType?: string;
  severity?: string;
  limit?: number;
  offset?: number;
}

export interface Integration {
  id: string;
  workspaceId: string;
  provider: string;
  displayName: string;
  description: string;
  status: 'active' | 'disconnected' | 'error' | 'not_connected';
  lastSyncAt: string | null;
  docsImported: number;
  config: Record<string, unknown>;
  featureFlag: boolean;
  createdAt: string | null;
}

export interface IntegrationListResponse {
  integrations: Integration[];
}

export interface AutomationRule {
  id: string;
  workspaceId: string;
  name: string;
  triggerType: string;
  condition: Record<string, unknown>;
  actions: Record<string, unknown>[];
  enabled: boolean;
  runCount: number;
  lastRunAt: string | null;
  createdAt: string;
}

export interface AutomationRuleListResponse {
  rules: AutomationRule[];
  total: number;
}

export interface CreateAutomationRulePayload {
  name: string;
  trigger_type: string;
  condition?: Record<string, unknown>;
  actions?: Record<string, unknown>[];
}

export interface PromptLibraryEntry {
  id: string;
  workspaceId: string;
  title: string;
  content: string;
  category: string;
  variables: string[];
  isFavorite: boolean;
  useCount: number;
  createdBy: string | null;
  createdAt: string;
}

export interface PromptLibraryListResponse {
  prompts: PromptLibraryEntry[];
  total: number;
}

export interface CreatePromptPayload {
  title: string;
  content: string;
  category?: string;
  variables?: string[];
}

export interface UpdatePromptPayload {
  title?: string;
  content?: string;
  category?: string;
  variables?: string[];
  is_favorite?: boolean;
}

// ─── Phase 13 — AI Agent Workspace ───────────────────────────────────────────

export type AgentCategory = 'legal' | 'research' | 'compliance' | 'sales' | 'hr' | 'knowledge' | 'custom';
export type AgentBehavior = 'precise' | 'balanced' | 'creative' | 'aggressive';
export type AgentRunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'review_required';
export type ReviewVerdict = 'approved' | 'rejected' | 'edited';
export type ReviewPriority = 'low' | 'medium' | 'high' | 'critical';
export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'edited';
export type WorkflowNodeType = 'trigger' | 'agent' | 'condition' | 'action' | 'output';

export interface Agent {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  avatar: string;
  color: string;
  category: AgentCategory;
  systemPrompt: string;
  behavior: AgentBehavior;
  temperature: number;
  model: string;
  allowedCollections: string[];
  allowedTools: string[];
  memoryEnabled: boolean;
  citationRequired: boolean;
  verificationMode: boolean;
  autoRetry: boolean;
  confidenceThreshold: number;
  isPinned: boolean;
  isFavorite: boolean;
  runCount: number;
  successRate: number;
  avgLatencyMs: number;
  avgTrustScore: number;
  createdBy: string | null;
  archivedAt: string | null;
  createdAt: string;
}

export interface AgentListResponse {
  agents: Agent[];
  total: number;
}

export interface CreateAgentPayload {
  name: string;
  description?: string;
  avatar?: string;
  color?: string;
  category?: AgentCategory;
  systemPrompt: string;
  behavior?: AgentBehavior;
  temperature?: number;
  model?: string;
  allowedCollections?: string[];
  allowedTools?: string[];
  memoryEnabled?: boolean;
  citationRequired?: boolean;
  verificationMode?: boolean;
  autoRetry?: boolean;
  confidenceThreshold?: number;
}

export interface UpdateAgentPayload {
  name?: string;
  description?: string;
  avatar?: string;
  color?: string;
  systemPrompt?: string;
  behavior?: AgentBehavior;
  temperature?: number;
  model?: string;
  allowedCollections?: string[];
  allowedTools?: string[];
  memoryEnabled?: boolean;
  citationRequired?: boolean;
  verificationMode?: boolean;
  autoRetry?: boolean;
  confidenceThreshold?: number;
  isPinned?: boolean;
  isFavorite?: boolean;
}

export interface AgentToolCall {
  id: string;
  runId: string;
  toolName: string;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  status: 'success' | 'failure' | 'pending';
  latencyMs: number;
  createdAt: string;
}

export interface AgentRun {
  id: string;
  workspaceId: string;
  agentId: string;
  agentName: string;
  status: AgentRunStatus;
  input: string;
  output: string | null;
  toolCalls: AgentToolCall[];
  tokensUsed: number;
  latencyMs: number;
  trustScore: number | null;
  confidence: number | null;
  costEstimate: number | null;
  humanReviewRequired: boolean;
  reviewedBy: string | null;
  reviewVerdict: string | null;
  reviewComment: string | null;
  pipelineAgents: string[];
  createdBy: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface AgentRunListResponse {
  runs: AgentRun[];
  total: number;
}

export interface TriggerAgentRunPayload {
  input: string;
  pipelineAgents?: string[];
}

export interface AgentAnalytics {
  agentId: string;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  reviewRequiredRuns: number;
  successRate: number;
  avgLatencyMs: number;
  avgTokensUsed: number;
  avgTrustScore: number;
  avgConfidence: number;
  totalToolCalls: number;
}

export interface ReviewQueueItem {
  id: string;
  workspaceId: string;
  agentId: string;
  agentName: string;
  runId: string;
  input: string;
  output: string;
  trustScore: number | null;
  confidence: number | null;
  reason: string;
  priority: ReviewPriority;
  status: ReviewStatus;
  reviewedBy: string | null;
  reviewComment: string | null;
  reviewVerdict: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface ReviewQueueListResponse {
  items: ReviewQueueItem[];
  total: number;
  pendingCount: number;
}

export interface ReviewDecisionPayload {
  verdict: ReviewVerdict;
  comment?: string;
  editedOutput?: string;
}

export interface ReviewQueueStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  edited: number;
  criticalPending: number;
  highPending: number;
}

export interface WorkflowNodeConfig {
  agentId?: string;
  condition?: string;
  actionType?: string;
  actionConfig?: Record<string, unknown>;
}

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  label: string;
  config: WorkflowNodeConfig;
  positionX: number;
  positionY: number;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label: string | null;
}

export interface Workflow {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  enabled: boolean;
  runCount: number;
  lastRunAt: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface WorkflowListResponse {
  workflows: Workflow[];
  total: number;
}

export interface CreateWorkflowPayload {
  name: string;
  description?: string;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
}

export interface UpdateWorkflowPayload {
  name?: string;
  description?: string;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
  enabled?: boolean;
}

export interface AvailableTool {
  name: string;
  description: string;
}

export interface AgentStreamEvent {
  type: 'status' | 'done' | 'error' | 'timeout';
  status?: AgentRunStatus;
  output?: string | null;
  message?: string;
}

// ---------------------------------------------------------------------------
// Pipeline Inspector
// ---------------------------------------------------------------------------

export interface PipelineInspectArtifacts {
  sourceSha256: string | null;
  extractionTextPreview: string | null;
  extractionBlockCount: number;
  normalizedTextPreview: string | null;
  normalizedBlockCount: number;
  metadata: Record<string, unknown> | null;
  preprocessingSegmentCount: number;
}

export interface PipelineInspectEvent {
  eventId: string;
  stage: string;
  status: string;
  progress: number;
  elapsedMs: number;
  worker: string | null;
  retryCount: number;
  error: string | null;
  stageTimings: Record<string, number> | null;
  workerInfo: {
    pid: number;
    hostname: string;
    memory_mb: number;
    cpu_percent: number;
    worker_version: string;
    build: string;
  } | null;
  createdAt: string;
}

export interface PipelineInspectDocumentRow {
  id: string;
  filename: string;
  status: DocumentStatus;
  sourceType: SourceType;
  pageCount: number | null;
  createdAt: string;
  error: string | null;
  // Ingestion
  ingestionRunId: string | null;
  ingestionStartedAt: string | null;
  ingestionCompletedAt: string | null;
  // Embedding
  embeddingRunId: string | null;
  embeddingStartedAt: string | null;
  embeddingCompletedAt: string | null;
  embeddingQueuedAt: string | null;
  embeddingRetryCount: number;
  currentEmbeddingProvider: string | null;
  currentEmbeddingModel: string | null;
  currentEmbeddingDimension: number | null;
  currentEmbeddingVersion: string | null;
  currentEmbeddingParserVersion: string | null;
  currentEmbeddingChunkVersion: string | null;
  // Indexing
  indexRunId: string | null;
  indexStartedAt: string | null;
  indexCompletedAt: string | null;
  indexQueuedAt: string | null;
  indexRetryCount: number;
  currentIndexProvider: string | null;
  currentIndexName: string | null;
  currentIndexNamespace: string | null;
}

export interface PipelineInspectReport {
  documentId: string;
  document: PipelineInspectDocumentRow;
  artifacts: PipelineInspectArtifacts | null;
  // Chunks
  chunks: DocumentChunk[];
  chunkCount: number;
  // Clauses
  clauses: Clause[];
  clauseCount: number;
  // Embeddings
  currentEmbeddingProvider: string | null;
  currentEmbeddingModel: string | null;
  currentEmbeddingDimension: number | null;
  currentEmbeddingVersion: string | null;
  currentEmbeddingParserVersion: string | null;
  currentEmbeddingChunkVersion: string | null;
  embeddings: DocumentEmbedding[];
  embeddingCount: number;
  staleEmbeddingCount: number;
  // Vector index
  currentIndexProvider: string | null;
  currentIndexName: string | null;
  currentIndexNamespace: string | null;
  vectors: DocumentVectorIndex[];
  vectorCount: number;
  staleVectorCount: number;
  // Timeline
  events: PipelineInspectEvent[];
  // Stats
  totalTokens: number;
  totalCostUsd: number;
  totalRetries: number;
  latestStageTimings: Record<string, number> | null;
  latestWorkerInfo: {
    pid: number;
    hostname: string;
    memory_mb: number;
    cpu_percent: number;
    worker_version: string;
    build: string;
  } | null;
}
