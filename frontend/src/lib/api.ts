/**
 * Typed API client for the Clarity backend.
 *
 * All requests attach the Clerk session token and the active workspace id.
 * Use `streamQuery` for SSE-based query responses.
 */

import { ApiError } from './apiError';

import type {
  Document,
  DocumentChunk,
  DocumentEmbeddingInspector,
  DocumentDetail,
  DocumentVectorIndexInspector,
  DeveloperDashboard,
  EmbeddingMetrics,
  IndexMetrics,
  RetrievalExplorerResponse,
  RetrievalFilters,
  RetrievalMetrics,
  RetrievalResponse,
  ConversationDetail,
  Conversation,
  DocumentFile,
  Message,
  Contradiction,
  EvalMetrics,
  StreamEvent,
  MeResponse,
  Workspace,
  AnswerExplorerResponse,
  AnswerMetrics,
  Citation,
  SpanRef,
  WorkspaceMember,
  MembersListResponse,
  SystemHealth,
  LiveMetrics,
  Collection,
  CollectionDetail,
  CollectionListResponse,
  CreateCollectionPayload,
  UpdateCollectionPayload,
  BenchmarkDataset,
  BenchmarkDatasetDetail,
  BenchmarkCase,
  BenchmarkRun,
  BenchmarkRunDetail,
  BenchmarkImportResult,
  CreateBenchmarkDatasetPayload,
  CreateBenchmarkCasePayload,
  EvalRun,
  EvalRunListResponse,
  QualityDashboard,
  RegressionListResponse,
  RegressionReport,
  ModelComparisonListResponse,
  CitationAnalytics,
  TrustAnalytics,
  ConversationEvalListResponse,
  ApiKey,
  ApiKeyCreated,
  ApiKeyListResponse,
  CreateApiKeyPayload,
  Webhook,
  WebhookListResponse,
  WebhookDeliveryListResponse,
  CreateWebhookPayload,
  AuditLog,
  AuditLogListResponse,
  AuditLogFilters,
  Integration,
  IntegrationListResponse,
  AutomationRule,
  AutomationRuleListResponse,
  CreateAutomationRulePayload,
  PromptLibraryEntry,
  PromptLibraryListResponse,
  CreatePromptPayload,
  UpdatePromptPayload,
  Agent,
  AgentListResponse,
  CreateAgentPayload,
  UpdateAgentPayload,
  AgentRun,
  AgentRunListResponse,
  TriggerAgentRunPayload,
  AgentAnalytics,
  ReviewQueueListResponse,
  ReviewQueueItem,
  ReviewDecisionPayload,
  ReviewQueueStats,
  Workflow,
  WorkflowListResponse,
  CreateWorkflowPayload,
  UpdateWorkflowPayload,
  AvailableTool,
  PipelineInspectReport,
  PipelinePerformanceProfile,
  PipelineConfig,
} from '@/types/clarity';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000';

// ---------------------------------------------------------------------------
// Core fetch wrapper
// ---------------------------------------------------------------------------

async function apiFetch<T>(
  path: string,
  options: RequestInit & { token: string; workspaceId?: string },
): Promise<T> {
  const { token, workspaceId, ...rest } = options;

  const response = await fetch(`${BACKEND_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(workspaceId ? { 'X-Workspace-Id': workspaceId } : {}),
      ...(rest.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw await parseApiError(response);
  }

  return response.json() as Promise<T>;
}

async function parseApiError(response: Response): Promise<ApiError> {
  // Pull Retry-After header if present
  const retryAfterHeader = response.headers.get('Retry-After');
  const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : null;

  // Read the body — backend can return either:
  //   { detail: { code, message } }   (FastAPI default with our middleware)
  //   { detail: "string" }            (plain FastAPI HTTPException)
  //   { error: { code, message } }     (older shape)
  //   { error: "string" }             (older)
  const body = await response
    .json()
    .catch(() => null) as
    | null
    | { detail?: unknown; error?: unknown };

  let code = 'http_error';
  let message = response.statusText || `Request failed (${response.status})`;

  if (body && typeof body === 'object') {
    // FastAPI /middleware shape: { error: { code, message } }
    const errObj = (body as { error?: unknown }).error;
    if (errObj && typeof errObj === 'object') {
      const eo = errObj as { code?: unknown; message?: unknown };
      if (typeof eo.code === 'string') code = eo.code;
      if (typeof eo.message === 'string' && eo.message) message = eo.message;
    } else if (typeof errObj === 'string' && errObj) {
      message = errObj;
    }
    // FastAPI default shape: { detail: "string" | { msg, code } }
    const detail = (body as { detail?: unknown }).detail;
    if (!errObj && detail) {
      if (typeof detail === 'string' && detail) {
        message = detail;
      } else if (detail && typeof detail === 'object') {
        const d = detail as { code?: unknown; message?: unknown; msg?: unknown };
        if (typeof d.code === 'string') code = d.code;
        if (typeof d.message === 'string' && d.message) message = d.message;
        else if (typeof d.msg === 'string' && d.msg) message = d.msg;
      }
    }
  }

  return new ApiError({
    status: response.status,
    code,
    message,
    retryAfter,
    payload: body,
  });
}

// ---------------------------------------------------------------------------
// Auth context type — callers provide this from Clerk's useAuth()
// ---------------------------------------------------------------------------
export interface AuthContext {
  token: string;
  workspaceId?: string;
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------
export async function getHealth(): Promise<{ status: string; version: string; environment: string }> {
  const response = await fetch(`${BACKEND_URL}/health`);
  if (!response.ok) throw new Error('Backend unreachable');
  return response.json();
}

// ---------------------------------------------------------------------------
// Auth + workspaces
// ---------------------------------------------------------------------------
export async function getMe(auth: AuthContext): Promise<MeResponse> {
  return apiFetch<MeResponse>('/api/me', { method: 'GET', ...auth });
}

export async function createWorkspace(
  auth: AuthContext,
  payload: { name: string },
): Promise<Workspace> {
  return apiFetch<Workspace>('/api/workspaces', {
    method: 'POST',
    body: JSON.stringify(payload),
    ...auth,
  });
}

// ---------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------

export async function createCheckoutSession(
  auth: AuthContext,
  plan: string,
  successUrl: string,
  cancelUrl: string,
  billingPeriod: 'monthly' | 'yearly' = 'monthly',
): Promise<{ url: string }> {
  return apiFetch<{ url: string }>('/api/billing/checkout', {
    method: 'POST',
    body: JSON.stringify({
      plan,
      success_url: successUrl,
      cancel_url: cancelUrl,
      billing_period: billingPeriod,
    }),
    ...auth,
  });
}

export async function createPortalSession(
  auth: AuthContext,
  returnUrl: string,
): Promise<{ url: string }> {
  return apiFetch<{ url: string }>('/api/billing/portal', {
    method: 'POST',
    body: JSON.stringify({ return_url: returnUrl }),
    ...auth,
  });
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export async function getWorkspaceMembers(
  auth: AuthContext,
  workspaceId: string,
): Promise<MembersListResponse> {
  return apiFetch<MembersListResponse>(`/api/workspaces/${workspaceId}/members`, {
    method: 'GET',
    ...auth,
  });
}

export async function addWorkspaceMember(
  auth: AuthContext,
  workspaceId: string,
  userId: string,
  role: string,
): Promise<WorkspaceMember> {
  return apiFetch<WorkspaceMember>(`/api/workspaces/${workspaceId}/members`, {
    method: 'POST',
    body: JSON.stringify({ userId, role }),
    ...auth,
  });
}

export async function updateMemberRole(
  auth: AuthContext,
  workspaceId: string,
  userId: string,
  role: string,
): Promise<WorkspaceMember> {
  return apiFetch<WorkspaceMember>(`/api/workspaces/${workspaceId}/members/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
    ...auth,
  });
}

export async function removeWorkspaceMember(
  auth: AuthContext,
  workspaceId: string,
  userId: string,
): Promise<void> {
  await apiFetch<void>(`/api/workspaces/${workspaceId}/members/${userId}`, {
    method: 'DELETE',
    ...auth,
  });
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------
export async function listDocuments(auth: AuthContext): Promise<Document[]> {
  const response = await apiFetch<{ documents: Document[] }>('/api/documents', { method: 'GET', ...auth });
  return response.documents;
}

export async function uploadDocument(
  auth: AuthContext,
  file: File,
): Promise<Document> {
  const form = new FormData();
  form.append('file', file);

  const response = await fetch(`${BACKEND_URL}/api/documents`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${auth.token}`,
      ...(auth.workspaceId ? { 'X-Workspace-Id': auth.workspaceId } : {}),
    },
    body: form,
  });

  if (!response.ok) {
    throw await parseApiError(response);
  }

  return response.json() as Promise<Document>;
}

export async function getDocument(
  auth: AuthContext,
  documentId: string,
): Promise<DocumentDetail> {
  return apiFetch<DocumentDetail>(`/api/documents/${documentId}`, { method: 'GET', ...auth });
}

export async function getDocumentFile(
  auth: AuthContext,
  documentId: string,
): Promise<DocumentFile> {
  return apiFetch<DocumentFile>(`/api/documents/${documentId}/file`, { method: 'GET', ...auth });
}

export async function deleteDocument(auth: AuthContext, documentId: string): Promise<void> {
  await apiFetch<void>(`/api/documents/${documentId}`, { method: 'DELETE', ...auth });
}

export async function listDocumentChunks(
  auth: AuthContext,
  documentId: string,
): Promise<DocumentChunk[]> {
  const response = await apiFetch<{ documentId: string; chunks: DocumentChunk[] }>(
    `/api/documents/${documentId}/chunks`,
    { method: 'GET', ...auth },
  );
  return response.chunks;
}

export async function getDocumentEmbeddings(
  auth: AuthContext,
  documentId: string,
): Promise<DocumentEmbeddingInspector> {
  return apiFetch<DocumentEmbeddingInspector>(`/api/documents/${documentId}/embeddings`, {
    method: 'GET',
    ...auth,
  });
}

export async function getEmbeddingMetrics(auth: AuthContext): Promise<EmbeddingMetrics> {
  return apiFetch<EmbeddingMetrics>('/api/developer/metrics/embeddings', {
    method: 'GET',
    ...auth,
  });
}

export async function getIndexMetrics(auth: AuthContext): Promise<IndexMetrics> {
  return apiFetch<IndexMetrics>('/api/developer/metrics/indexing', {
    method: 'GET',
    ...auth,
  });
}

export async function getRetrievalMetrics(auth: AuthContext): Promise<RetrievalMetrics> {
  return apiFetch<RetrievalMetrics>('/api/developer/metrics/retrieval', {
    method: 'GET',
    ...auth,
  });
}

export async function getAnswerMetrics(auth: AuthContext): Promise<AnswerMetrics> {
  return apiFetch<AnswerMetrics>('/api/developer/metrics/answers', {
    method: 'GET',
    ...auth,
  });
}

export async function getDeveloperDashboard(auth: AuthContext): Promise<DeveloperDashboard> {
  return apiFetch<DeveloperDashboard>('/api/developer/dashboard', {
    method: 'GET',
    ...auth,
  });
}

export async function getDocumentVectorIndex(
  auth: AuthContext,
  documentId: string,
): Promise<DocumentVectorIndexInspector> {
  return apiFetch<DocumentVectorIndexInspector>(`/api/documents/${documentId}/vectors`, {
    method: 'GET',
    ...auth,
  });
}

export async function searchRetrieval(
  auth: AuthContext,
  payload: { query: string; documentIds?: string[]; filters?: RetrievalFilters; limit?: number },
): Promise<RetrievalResponse> {
  return apiFetch<RetrievalResponse>('/api/retrieval/search', {
    method: 'POST',
    body: JSON.stringify(payload),
    ...auth,
  });
}

export async function exploreRetrieval(
  auth: AuthContext,
  payload: { query: string; documentIds?: string[]; filters?: RetrievalFilters; limit?: number },
): Promise<RetrievalExplorerResponse> {
  return apiFetch<RetrievalExplorerResponse>('/api/developer/retrieval/explore', {
    method: 'POST',
    body: JSON.stringify(payload),
    ...auth,
  });
}

// ---------------------------------------------------------------------------
// Conversations + Messages
// ---------------------------------------------------------------------------
export async function listConversations(auth: AuthContext): Promise<Conversation[]> {
  const response = await apiFetch<{ conversations: Conversation[] }>('/api/conversations', {
    method: 'GET',
    ...auth,
  });
  return response.conversations;
}

export async function getConversation(
  auth: AuthContext,
  conversationId: string,
): Promise<ConversationDetail> {
  return apiFetch(`/api/conversations/${conversationId}`, { method: 'GET', ...auth });
}

export async function getMessageCitations(
  auth: AuthContext,
  messageId: string,
): Promise<Citation[]> {
  return apiFetch<Citation[]>(`/api/messages/${messageId}/citations`, { method: 'GET', ...auth });
}

export async function getClaimSpans(
  auth: AuthContext,
  claimId: string,
): Promise<SpanRef[]> {
  const response = await apiFetch<{ spans: SpanRef[] }>(`/api/claims/${claimId}/spans`, {
    method: 'GET',
    ...auth,
  });
  return response.spans;
}

export async function getAnswerExplorer(auth: AuthContext): Promise<AnswerExplorerResponse> {
  return apiFetch<AnswerExplorerResponse>('/api/developer/answers', { method: 'GET', ...auth });
}

// ---------------------------------------------------------------------------
// Query — SSE stream
// ---------------------------------------------------------------------------
export function streamQuery(
  auth: AuthContext,
  payload: { query: string; documentIds?: string[]; conversationId?: string; requestId: string },
  onEvent: (event: StreamEvent) => void,
  onError: (err: Error) => void,
): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
          ...(auth.workspaceId ? { 'X-Workspace-Id': auth.workspaceId } : {}),
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        onError(await parseApiError(response));
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw || raw === '[DONE]') continue;
          try {
            const event: StreamEvent = JSON.parse(raw);
            onEvent(event);
          } catch {
            // Malformed SSE frame — skip, don't crash
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        onError(err as Error);
      }
    }
  })();

  return () => controller.abort();
}

export function resumeAnswerStream(
  auth: AuthContext,
  payload: { conversationId: string; answerRunId: string; after?: number },
  onEvent: (event: StreamEvent) => void,
  onError: (err: Error) => void,
): () => void {
  const controller = new AbortController();
  const afterQuery = payload.after ? `?after=${payload.after}` : '';

  (async () => {
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/chat/conversations/${payload.conversationId}/answers/${payload.answerRunId}/stream${afterQuery}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${auth.token}`,
            ...(auth.workspaceId ? { 'X-Workspace-Id': auth.workspaceId } : {}),
            Accept: 'text/event-stream',
          },
          signal: controller.signal,
        },
      );

      if (!response.ok || !response.body) {
        onError(await parseApiError(response));
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw || raw === '[DONE]') continue;
          try {
            const event: StreamEvent = JSON.parse(raw);
            onEvent(event);
          } catch {
            // Ignore malformed frames during replay.
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        onError(err as Error);
      }
    }
  })();

  return () => controller.abort();
}

// ---------------------------------------------------------------------------
// Contradictions
// ---------------------------------------------------------------------------
export async function listContradictions(auth: AuthContext): Promise<Contradiction[]> {
  return apiFetch<Contradiction[]>('/api/contradictions', { method: 'GET', ...auth });
}

// ---------------------------------------------------------------------------
// Eval metrics — backed by /api/evaluations
// ---------------------------------------------------------------------------
export async function getEvalMetrics(
  auth: AuthContext,
  _suite: 'golden' | 'adversarial' = 'golden',
): Promise<EvalMetrics[]> {
  const response = await apiFetch<{
    evaluations: Array<{
      createdAt: string;
      scores?: {
        faithfulness?: number | null;
        grounding?: number | null;
        completeness?: number | null;
        correctness?: number | null;
        overall?: number | null;
      } | null;
    }>;
    total: number;
  }>('/api/evaluations', { method: 'GET', ...auth });

  return response.evaluations.map((run) => ({
    faithfulness: run.scores?.faithfulness != null ? run.scores.faithfulness / 10 : null,
    relevance: run.scores?.grounding != null ? run.scores.grounding / 10 : null,
    contextPrecision: run.scores?.correctness != null ? run.scores.correctness / 10 : null,
    contextRecall: run.scores?.completeness != null ? run.scores.completeness / 10 : null,
    catchRate: run.scores?.overall != null ? run.scores.overall / 10 : undefined,
    casesTotal: 1,
    suite: _suite,
    createdAt: run.createdAt,
  }));
}

// ---------------------------------------------------------------------------
// B4: Experiments
// ---------------------------------------------------------------------------
export async function listExperiments(auth: AuthContext): Promise<import('@/types/clarity').ExperimentListResponse> {
  return apiFetch('/api/experiments', { method: 'GET', ...auth });
}

export async function createExperiment(
  auth: AuthContext,
  payload: { name: string; description?: string },
): Promise<import('@/types/clarity').Experiment> {
  return apiFetch('/api/experiments', { method: 'POST', body: JSON.stringify(payload), ...auth });
}

export async function getExperiment(
  auth: AuthContext,
  experimentId: string,
): Promise<import('@/types/clarity').Experiment> {
  return apiFetch(`/api/experiments/${experimentId}`, { method: 'GET', ...auth });
}

// ---------------------------------------------------------------------------
// B4: Prompts
// ---------------------------------------------------------------------------
export async function listPromptVersions(
  auth: AuthContext,
  promptKey?: string,
): Promise<import('@/types/clarity').PromptVersionListResponse> {
  const qs = promptKey ? `?prompt_key=${promptKey}` : '';
  return apiFetch(`/api/prompts${qs}`, { method: 'GET', ...auth });
}

export async function createPromptVersion(
  auth: AuthContext,
  payload: { promptKey: string; version: string; content: string; description?: string; author?: string },
): Promise<import('@/types/clarity').PromptVersion> {
  const body = {
    prompt_key: payload.promptKey,
    version: payload.version,
    content: payload.content,
    description: payload.description,
    author: payload.author,
  };
  return apiFetch('/api/prompts', { method: 'POST', body: JSON.stringify(body), ...auth });
}

export async function activatePromptVersion(
  auth: AuthContext,
  promptId: string,
): Promise<import('@/types/clarity').PromptVersion> {
  return apiFetch(`/api/prompts/${promptId}/activate`, { method: 'POST', ...auth });
}

// ---------------------------------------------------------------------------
// B4: Optimization
// ---------------------------------------------------------------------------
export async function listOptimizationRecommendations(
  auth: AuthContext,
  status?: string,
): Promise<import('@/types/clarity').OptimizationListResponse> {
  const qs = status ? `?status_filter=${status}` : '';
  return apiFetch(`/api/optimization${qs}`, { method: 'GET', ...auth });
}

export async function runOptimizationAnalysis(
  auth: AuthContext,
): Promise<import('@/types/clarity').OptimizationListResponse> {
  return apiFetch('/api/optimization/analyze', { method: 'POST', ...auth });
}

export async function updateRecommendation(
  auth: AuthContext,
  recId: string,
  status: 'accepted' | 'dismissed',
): Promise<import('@/types/clarity').OptimizationRecommendation> {
  return apiFetch(`/api/optimization/${recId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
    ...auth,
  });
}

// ---------------------------------------------------------------------------
// B4: Quality Gates
// ---------------------------------------------------------------------------
export async function listQualityGateRules(auth: AuthContext): Promise<import('@/types/clarity').QualityGateRule[]> {
  return apiFetch('/api/quality-gates/rules', { method: 'GET', ...auth });
}

export async function createQualityGateRule(
  auth: AuthContext,
  payload: { name: string; metric: string; operator: string; threshold: number },
): Promise<import('@/types/clarity').QualityGateRule> {
  return apiFetch('/api/quality-gates/rules', { method: 'POST', body: JSON.stringify(payload), ...auth });
}

export async function runQualityGate(
  auth: AuthContext,
  payload: { benchmarkRunId?: string; experimentId?: string },
): Promise<import('@/types/clarity').QualityGateRun> {
  const body = { benchmark_run_id: payload.benchmarkRunId, experiment_id: payload.experimentId };
  return apiFetch('/api/quality-gates/run', { method: 'POST', body: JSON.stringify(body), ...auth });
}

export async function listQualityGateRuns(auth: AuthContext): Promise<import('@/types/clarity').QualityGateRunListResponse> {
  return apiFetch('/api/quality-gates/runs', { method: 'GET', ...auth });
}

// ---------------------------------------------------------------------------
// B4: Release Notes
// ---------------------------------------------------------------------------
export async function listReleaseNotes(auth: AuthContext): Promise<import('@/types/clarity').ReleaseNoteListResponse> {
  return apiFetch('/api/release-notes', { method: 'GET', ...auth });
}

// ---------------------------------------------------------------------------
// B4: Benchmark Suggestions
// ---------------------------------------------------------------------------
export async function listBenchmarkSuggestions(
  auth: AuthContext,
  status?: string,
): Promise<import('@/types/clarity').BenchmarkSuggestionListResponse> {
  const qs = status ? `?suggestion_status=${status}` : '';
  return apiFetch(`/api/benchmark-suggestions${qs}`, { method: 'GET', ...auth });
}

export async function scanBenchmarkSuggestions(
  auth: AuthContext,
): Promise<import('@/types/clarity').BenchmarkSuggestionListResponse> {
  return apiFetch('/api/benchmark-suggestions/scan', { method: 'POST', ...auth });
}

export async function dismissSuggestion(
  auth: AuthContext,
  suggestionId: string,
): Promise<import('@/types/clarity').BenchmarkSuggestion> {
  return apiFetch(`/api/benchmark-suggestions/${suggestionId}/dismiss`, { method: 'POST', ...auth });
}

// ---------------------------------------------------------------------------
// Observability
// ---------------------------------------------------------------------------

export async function getSystemHealth(): Promise<SystemHealth> {
  const res = await fetch(`${BACKEND_URL}/health/ready`);
  if (!res.ok && res.status !== 503) throw new Error(`Health check failed: ${res.status}`);
  return res.json() as Promise<SystemHealth>;
}

export async function getLiveMetrics(auth: AuthContext): Promise<LiveMetrics> {
  return apiFetch<LiveMetrics>('/api/metrics', { method: 'GET', ...auth });
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

export async function listCollections(auth: AuthContext): Promise<CollectionListResponse> {
  return apiFetch<CollectionListResponse>('/api/collections', { method: 'GET', ...auth });
}

export async function createCollection(
  auth: AuthContext,
  payload: CreateCollectionPayload,
): Promise<Collection> {
  return apiFetch<Collection>('/api/collections', {
    method: 'POST',
    body: JSON.stringify(payload),
    ...auth,
  });
}

export async function getCollection(
  auth: AuthContext,
  collectionId: string,
): Promise<CollectionDetail> {
  return apiFetch<CollectionDetail>(`/api/collections/${collectionId}`, {
    method: 'GET',
    ...auth,
  });
}

export async function updateCollection(
  auth: AuthContext,
  collectionId: string,
  payload: UpdateCollectionPayload,
): Promise<Collection> {
  return apiFetch<Collection>(`/api/collections/${collectionId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    ...auth,
  });
}

export async function deleteCollection(auth: AuthContext, collectionId: string): Promise<void> {
  await apiFetch<void>(`/api/collections/${collectionId}`, {
    method: 'DELETE',
    ...auth,
  });
}

export async function addDocumentToCollection(
  auth: AuthContext,
  collectionId: string,
  documentId: string,
): Promise<void> {
  await apiFetch<void>(`/api/collections/${collectionId}/documents`, {
    method: 'POST',
    body: JSON.stringify({ document_id: documentId }),
    ...auth,
  });
}

export async function removeDocumentFromCollection(
  auth: AuthContext,
  collectionId: string,
  documentId: string,
): Promise<void> {
  await apiFetch<void>(`/api/collections/${collectionId}/documents/${documentId}`, {
    method: 'DELETE',
    ...auth,
  });
}

// ─── Phase 11 — Benchmark API ──────────────────────────────────────────────────

export async function listBenchmarkDatasets(auth: AuthContext): Promise<BenchmarkDataset[]> {
  return apiFetch<BenchmarkDataset[]>('/api/benchmarks/datasets', auth);
}

export async function getBenchmarkDataset(auth: AuthContext, datasetId: string): Promise<BenchmarkDatasetDetail> {
  return apiFetch<BenchmarkDatasetDetail>(`/api/benchmarks/datasets/${datasetId}`, auth);
}

export async function createBenchmarkDataset(
  auth: AuthContext,
  payload: CreateBenchmarkDatasetPayload,
): Promise<BenchmarkDataset> {
  return apiFetch<BenchmarkDataset>('/api/benchmarks/datasets', {
    method: 'POST',
    body: JSON.stringify({ name: payload.name, dataset_type: payload.datasetType, description: payload.description }),
    ...auth,
  });
}

export async function deleteBenchmarkDataset(auth: AuthContext, datasetId: string): Promise<void> {
  await apiFetch<void>(`/api/benchmarks/datasets/${datasetId}`, { method: 'DELETE', ...auth });
}

export async function listBenchmarkCases(auth: AuthContext, datasetId: string): Promise<BenchmarkCase[]> {
  return apiFetch<BenchmarkCase[]>(`/api/benchmarks/datasets/${datasetId}/cases`, auth);
}

export async function addBenchmarkCase(
  auth: AuthContext,
  datasetId: string,
  payload: CreateBenchmarkCasePayload,
): Promise<BenchmarkCase> {
  return apiFetch<BenchmarkCase>(`/api/benchmarks/datasets/${datasetId}/cases`, {
    method: 'POST',
    body: JSON.stringify({ question: payload.question, reference_answer: payload.referenceAnswer, document_ids: payload.documentIds ?? [] }),
    ...auth,
  });
}

export async function importBenchmarkCases(
  auth: AuthContext,
  datasetId: string,
  file: File,
): Promise<BenchmarkImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${BACKEND_URL}/api/benchmarks/datasets/${datasetId}/import`, {
    method: 'POST',
    body: formData,
    headers: {
      Authorization: `Bearer ${auth.token}`,
      ...(auth.workspaceId ? { 'X-Workspace-Id': auth.workspaceId } : {}),
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<BenchmarkImportResult>;
}

export async function triggerBenchmarkRun(auth: AuthContext, datasetId: string): Promise<BenchmarkRun> {
  return apiFetch<BenchmarkRun>(`/api/benchmarks/datasets/${datasetId}/runs`, { method: 'POST', ...auth });
}

export async function listDatasetRuns(auth: AuthContext, datasetId: string): Promise<BenchmarkRun[]> {
  return apiFetch<BenchmarkRun[]>(`/api/benchmarks/datasets/${datasetId}/runs`, auth);
}

export async function listBenchmarkRuns(auth: AuthContext): Promise<BenchmarkRun[]> {
  return apiFetch<BenchmarkRun[]>('/api/benchmarks/runs', auth);
}

export async function getBenchmarkRun(auth: AuthContext, runId: string): Promise<BenchmarkRunDetail> {
  return apiFetch<BenchmarkRunDetail>(`/api/benchmarks/runs/${runId}`, auth);
}

// ─── Phase 11 — Evaluation API ────────────────────────────────────────────────

export async function listEvalRuns(auth: AuthContext, limit = 20): Promise<EvalRunListResponse> {
  return apiFetch<EvalRunListResponse>(`/api/evaluations?limit=${limit}`, auth);
}

export async function getQualityDashboard(auth: AuthContext, days = 30): Promise<QualityDashboard> {
  return apiFetch<QualityDashboard>(`/api/evaluations/quality/dashboard?days=${days}`, auth);
}

export async function getCitationAnalytics(auth: AuthContext, days = 30): Promise<CitationAnalytics> {
  return apiFetch<CitationAnalytics>(`/api/evaluations/analytics/citations?days=${days}`, auth);
}

export async function getTrustAnalytics(auth: AuthContext, days = 30): Promise<TrustAnalytics> {
  return apiFetch<TrustAnalytics>(`/api/evaluations/analytics/trust?days=${days}`, auth);
}

export async function getConversationEvals(auth: AuthContext, limit = 20): Promise<ConversationEvalListResponse> {
  return apiFetch<ConversationEvalListResponse>(`/api/evaluations/analytics/conversations?limit=${limit}`, auth);
}

export async function triggerQualityRollup(auth: AuthContext): Promise<unknown> {
  return apiFetch<unknown>('/api/evaluations/quality/rollup', { method: 'POST', ...auth });
}

// ─── Phase 11 — Regression + Model Comparison API ────────────────────────────

export async function listRegressions(auth: AuthContext, onlyFlagged = false): Promise<RegressionListResponse> {
  return apiFetch<RegressionListResponse>(`/api/regressions?only_flagged=${onlyFlagged}`, auth);
}

export async function getRegression(auth: AuthContext, reportId: string): Promise<RegressionReport> {
  return apiFetch<RegressionReport>(`/api/regressions/${reportId}`, auth);
}

export async function listModelComparisons(auth: AuthContext): Promise<ModelComparisonListResponse> {
  return apiFetch<ModelComparisonListResponse>('/api/model-comparisons', auth);
}

// ─── Phase 12 — Enterprise API ────────────────────────────────────────────────

export async function listApiKeys(auth: AuthContext): Promise<ApiKeyListResponse> {
  return apiFetch<ApiKeyListResponse>('/api/enterprise/api-keys', auth);
}

export async function createApiKey(auth: AuthContext, payload: CreateApiKeyPayload): Promise<ApiKeyCreated> {
  return apiFetch<ApiKeyCreated>('/api/enterprise/api-keys', {
    method: 'POST',
    body: JSON.stringify({ name: payload.name, scopes: payload.scopes ?? [], expires_in_days: payload.expiresInDays }),
    ...auth,
  });
}

export async function revokeApiKey(auth: AuthContext, keyId: string): Promise<void> {
  await apiFetch<unknown>(`/api/enterprise/api-keys/${keyId}`, { method: 'DELETE', ...auth });
}

export async function listWebhooks(auth: AuthContext): Promise<WebhookListResponse> {
  return apiFetch<WebhookListResponse>('/api/enterprise/webhooks', auth);
}

export async function createWebhook(auth: AuthContext, payload: CreateWebhookPayload): Promise<Webhook> {
  return apiFetch<Webhook>('/api/enterprise/webhooks', {
    method: 'POST',
    body: JSON.stringify(payload),
    ...auth,
  });
}

export async function toggleWebhook(auth: AuthContext, webhookId: string): Promise<Webhook> {
  return apiFetch<Webhook>(`/api/enterprise/webhooks/${webhookId}`, { method: 'PATCH', ...auth });
}

export async function deleteWebhook(auth: AuthContext, webhookId: string): Promise<void> {
  await apiFetch<unknown>(`/api/enterprise/webhooks/${webhookId}`, { method: 'DELETE', ...auth });
}

export async function listWebhookDeliveries(auth: AuthContext, webhookId: string): Promise<WebhookDeliveryListResponse> {
  return apiFetch<WebhookDeliveryListResponse>(`/api/enterprise/webhooks/${webhookId}/deliveries`, auth);
}

export async function listAuditLogs(auth: AuthContext, filters?: AuditLogFilters): Promise<AuditLogListResponse> {
  const params = new URLSearchParams();
  if (filters?.action) params.set('action', filters.action);
  if (filters?.userId) params.set('user_id', filters.userId);
  if (filters?.resourceType) params.set('resource_type', filters.resourceType);
  if (filters?.severity) params.set('severity', filters.severity);
  if (filters?.limit) params.set('limit', String(filters.limit));
  if (filters?.offset) params.set('offset', String(filters.offset));
  const qs = params.toString();
  return apiFetch<AuditLogListResponse>(`/api/enterprise/audit-logs${qs ? `?${qs}` : ''}`, auth);
}

export async function listIntegrations(auth: AuthContext): Promise<IntegrationListResponse> {
  return apiFetch<IntegrationListResponse>('/api/enterprise/integrations', auth);
}

export async function disconnectIntegration(auth: AuthContext, provider: string): Promise<Integration> {
  return apiFetch<Integration>(`/api/enterprise/integrations/${provider}/disconnect`, { method: 'POST', ...auth });
}

export async function listAutomationRules(auth: AuthContext): Promise<AutomationRuleListResponse> {
  return apiFetch<AutomationRuleListResponse>('/api/enterprise/automation-rules', auth);
}

export async function createAutomationRule(auth: AuthContext, payload: CreateAutomationRulePayload): Promise<AutomationRule> {
  return apiFetch<AutomationRule>('/api/enterprise/automation-rules', {
    method: 'POST',
    body: JSON.stringify(payload),
    ...auth,
  });
}

export async function toggleAutomationRule(auth: AuthContext, ruleId: string): Promise<AutomationRule> {
  return apiFetch<AutomationRule>(`/api/enterprise/automation-rules/${ruleId}`, { method: 'PATCH', ...auth });
}

export async function deleteAutomationRule(auth: AuthContext, ruleId: string): Promise<void> {
  await apiFetch<unknown>(`/api/enterprise/automation-rules/${ruleId}`, { method: 'DELETE', ...auth });
}

export async function listPromptLibrary(
  auth: AuthContext,
  opts?: { category?: string; favoritesOnly?: boolean },
): Promise<PromptLibraryListResponse> {
  const params = new URLSearchParams();
  if (opts?.category) params.set('category', opts.category);
  if (opts?.favoritesOnly) params.set('favorites_only', 'true');
  const qs = params.toString();
  return apiFetch<PromptLibraryListResponse>(`/api/enterprise/prompt-library${qs ? `?${qs}` : ''}`, auth);
}

export async function createPromptEntry(auth: AuthContext, payload: CreatePromptPayload): Promise<PromptLibraryEntry> {
  return apiFetch<PromptLibraryEntry>('/api/enterprise/prompt-library', {
    method: 'POST',
    body: JSON.stringify(payload),
    ...auth,
  });
}

export async function updatePromptEntry(
  auth: AuthContext,
  promptId: string,
  payload: UpdatePromptPayload,
): Promise<PromptLibraryEntry> {
  return apiFetch<PromptLibraryEntry>(`/api/enterprise/prompt-library/${promptId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    ...auth,
  });
}

export async function deletePromptEntry(auth: AuthContext, promptId: string): Promise<void> {
  await apiFetch<unknown>(`/api/enterprise/prompt-library/${promptId}`, { method: 'DELETE', ...auth });
}

// ─── Phase 13 — AI Agent Workspace ────────────────────────────────────────────

export async function listAgents(auth: AuthContext, category?: string): Promise<AgentListResponse> {
  const qs = category ? `?category=${encodeURIComponent(category)}` : '';
  return apiFetch<AgentListResponse>(`/api/agents${qs}`, auth);
}

export async function createAgent(auth: AuthContext, payload: CreateAgentPayload): Promise<Agent> {
  return apiFetch<Agent>('/api/agents', { method: 'POST', body: JSON.stringify(payload), ...auth });
}

export async function getAgent(auth: AuthContext, agentId: string): Promise<Agent> {
  return apiFetch<Agent>(`/api/agents/${agentId}`, auth);
}

export async function updateAgent(auth: AuthContext, agentId: string, payload: UpdateAgentPayload): Promise<Agent> {
  return apiFetch<Agent>(`/api/agents/${agentId}`, { method: 'PATCH', body: JSON.stringify(payload), ...auth });
}

export async function deleteAgent(auth: AuthContext, agentId: string): Promise<void> {
  await apiFetch<unknown>(`/api/agents/${agentId}`, { method: 'DELETE', ...auth });
}

export async function archiveAgent(auth: AuthContext, agentId: string): Promise<Agent> {
  return apiFetch<Agent>(`/api/agents/${agentId}/archive`, { method: 'POST', ...auth });
}

export async function triggerAgentRun(auth: AuthContext, agentId: string, payload: TriggerAgentRunPayload): Promise<AgentRun> {
  return apiFetch<AgentRun>(`/api/agents/${agentId}/runs`, { method: 'POST', body: JSON.stringify(payload), ...auth });
}

export async function listAgentRuns(auth: AuthContext, agentId: string, limit = 50): Promise<AgentRunListResponse> {
  return apiFetch<AgentRunListResponse>(`/api/agents/${agentId}/runs?limit=${limit}`, auth);
}

export async function getAgentRun(auth: AuthContext, runId: string): Promise<AgentRun> {
  return apiFetch<AgentRun>(`/api/agents/runs/${runId}`, auth);
}

export async function getAgentAnalytics(auth: AuthContext, agentId: string): Promise<AgentAnalytics> {
  return apiFetch<AgentAnalytics>(`/api/agents/${agentId}/analytics`, auth);
}

export async function listAvailableTools(auth: AuthContext): Promise<{ tools: AgentToolDescriptor[] }> {
  // Hits the runtime router which returns rich AgentToolDescriptor.
  return apiFetch<{ tools: AgentToolDescriptor[] }>('/api/agents/tools', auth);
}

// ─── Agent lifecycle extensions (restore, duplicate, clone, version) ─────────

export async function restoreAgent(auth: AuthContext, agentId: string): Promise<Agent> {
  return apiFetch<Agent>(`/api/agents/${agentId}/restore`, { method: 'POST', ...auth });
}

export async function duplicateAgent(auth: AuthContext, agentId: string): Promise<Agent> {
  return apiFetch<Agent>(`/api/agents/${agentId}/duplicate`, { method: 'POST', ...auth });
}

export async function cloneAgent(
  auth: AuthContext,
  agentId: string,
  targetWorkspaceId?: string,
): Promise<Agent> {
  const qs = targetWorkspaceId ? `?target_workspace_id=${encodeURIComponent(targetWorkspaceId)}` : '';
  return apiFetch<Agent>(`/api/agents/${agentId}/clone${qs}`, { method: 'POST', ...auth });
}

export async function versionAgent(auth: AuthContext, agentId: string): Promise<Agent> {
  return apiFetch<Agent>(`/api/agents/${agentId}/version`, { method: 'POST', ...auth });
}

export async function bulkDeleteAgents(
  auth: AuthContext,
  agentIds: string[],
): Promise<{ deleted: string[]; failed: Array<{ id: string; reason: string }>; deleted_count: number }> {
  return apiFetch(`/api/agents/bulk-delete`, {
    method: 'POST',
    body: JSON.stringify({ agent_ids: agentIds }),
    ...auth,
  });
}

export async function bulkArchiveAgents(
  auth: AuthContext,
  agentIds: string[],
): Promise<{ archived: string[]; failed: Array<{ id: string; reason: string }>; archived_count: number }> {
  return apiFetch(`/api/agents/bulk-archive`, {
    method: 'POST',
    body: JSON.stringify({ agent_ids: agentIds }),
    ...auth,
  });
}

export async function exportAgents(
  auth: AuthContext,
  includeArchived = false,
): Promise<{ version: string; exported_at: string; workspace_id: string; count: number; agents: Array<Record<string, unknown>> }> {
  const qs = includeArchived ? '?archived=true' : '';
  return apiFetch(`/api/agents/export${qs}`, auth);
}

export async function importAgents(
  auth: AuthContext,
  bundle: { version?: string; agents: Array<Record<string, unknown>> },
): Promise<{ created: string[]; failed: Array<{ name: string; reason: string }>; created_count: number }> {
  return apiFetch(`/api/agents/import`, {
    method: 'POST',
    body: JSON.stringify(bundle),
    ...auth,
  });
}

// ─── Agent Runtime (autonomous execution) ────────────────────────────────────

import type {
  AgentRuntimeEvent,
  AgentRunGraph,
  AgentRunMemory,
  AgentToolDescriptor,
} from '@/types/clarity';

export interface TriggerAgentRunStreamingOptions {
  input: string;
  signal?: AbortSignal;
  onEvent: (event: AgentRuntimeEvent) => void;
  onError?: (err: Error) => void;
  onComplete?: () => void;
}

export async function triggerAgentRunStreaming(
  auth: AuthContext,
  agentId: string,
  options: TriggerAgentRunStreamingOptions,
): Promise<{ runId: string; abort: () => void }> {
  const params = new URLSearchParams();
  params.set('input', options.input);
  params.set('stream', 'true');
  const url = `/api/agents/${agentId}/runs?${params.toString()}`;
  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;

  const controller = new AbortController();
  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort());
  }

  const response = await fetch(fullUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${auth.token ?? ''}`,
      'X-Workspace-Id': auth.workspaceId ?? '',
      Accept: 'text/event-stream',
    },
    signal: controller.signal,
  });

  if (!response.ok || !response.body) {
    const errText = await response.text().catch(() => '');
    const err = new Error(`trigger_failed:${response.status}:${errText}`);
    options.onError?.(err);
    throw err;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let runId = '';

  const pump = async () => {
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          if (!frame.trim()) continue;
          let dataLine: string | null = null;
          for (const line of frame.split('\n')) {
            if (line.startsWith('data:')) dataLine = line.slice(5).trim();
          }
          if (!dataLine) continue;
          try {
            const ev = JSON.parse(dataLine) as AgentRuntimeEvent;
            if (ev.runId) runId = ev.runId;
            options.onEvent(ev);
            if (ev.type === 'completed' || ev.type === 'cancelled' || ev.type === 'error') {
              options.onComplete?.();
            }
          } catch {
            // malformed line — skip
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        options.onError?.(err as Error);
      }
    } finally {
      options.onComplete?.();
    }
  };
  void pump();

  return { runId, abort: () => controller.abort() };
}

export async function getAgentRunGraph(auth: AuthContext, runId: string): Promise<AgentRunGraph> {
  return apiFetch<AgentRunGraph>(`/api/agents/runs/${runId}/graph`, auth);
}

export async function getAgentRunMemory(
  auth: AuthContext,
  runId: string,
  scope?: 'run' | 'global',
): Promise<{ entries: AgentRunMemory[]; count: number }> {
  const qs = scope ? `?scope=${scope}` : '';
  return apiFetch<{ entries: AgentRunMemory[]; count: number }>(`/api/agents/runs/${runId}/memory${qs}`, auth);
}

export async function listAgentRunToolCalls(
  auth: AuthContext,
  runId: string,
): Promise<{ tool_calls: Array<Record<string, unknown>>; count: number }> {
  return apiFetch<{ tool_calls: Array<Record<string, unknown>>; count: number }>(
    `/api/agents/runs/${runId}/tool-calls`,
    auth,
  );
}

export async function listAgentRunEvents(
  auth: AuthContext,
  runId: string,
  after = 0,
  limit = 200,
): Promise<{ events: Array<Record<string, unknown>>; count: number }> {
  return apiFetch<{ events: Array<Record<string, unknown>>; count: number }>(
    `/api/agents/runs/${runId}/events?after=${after}&limit=${limit}`,
    auth,
  );
}

export async function cancelAgentRun(auth: AuthContext, runId: string): Promise<{ run_id: string; status: string }> {
  return apiFetch<{ run_id: string; status: string }>(`/api/agents/runs/${runId}/cancel`, {
    method: 'POST',
    ...auth,
  });
}

export async function resumeAgentRun(auth: AuthContext, runId: string): Promise<{ run_id: string; status: string }> {
  return apiFetch<{ run_id: string; status: string }>(`/api/agents/runs/${runId}/resume`, {
    method: 'POST',
    ...auth,
  });
}

export async function approveAgentRun(
  auth: AuthContext,
  runId: string,
  editedOutput?: string,
): Promise<{ run_id: string; decision: string; approval_id: string }> {
  const qs = editedOutput ? `?edited_output=${encodeURIComponent(editedOutput)}` : '';
  return apiFetch<{ run_id: string; decision: string; approval_id: string }>(
    `/api/agents/runs/${runId}/approve${qs}`,
    { method: 'POST', ...auth },
  );
}

export async function rejectAgentRun(
  auth: AuthContext,
  runId: string,
  reason?: string,
): Promise<{ run_id: string; decision: string; approval_id: string }> {
  const qs = reason ? `?reason=${encodeURIComponent(reason)}` : '';
  return apiFetch<{ run_id: string; decision: string; approval_id: string }>(
    `/api/agents/runs/${runId}/reject${qs}`,
    { method: 'POST', ...auth },
  );
}

export async function listRuntimeTools(auth: AuthContext): Promise<{ tools: AgentToolDescriptor[] }> {
  return apiFetch<{ tools: AgentToolDescriptor[] }>('/api/agents/tools', auth);
}

// ─── Review Queue ─────────────────────────────────────────────────────────────

export async function listReviewQueue(
  auth: AuthContext,
  opts?: { status?: string; priority?: string; limit?: number },
): Promise<ReviewQueueListResponse> {
  const params = new URLSearchParams();
  if (opts?.status) params.set('status_filter', opts.status);
  if (opts?.priority) params.set('priority', opts.priority);
  if (opts?.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  return apiFetch<ReviewQueueListResponse>(`/api/review-queue${qs ? `?${qs}` : ''}`, auth);
}

export async function submitReviewDecision(
  auth: AuthContext,
  itemId: string,
  payload: ReviewDecisionPayload,
): Promise<ReviewQueueItem> {
  return apiFetch<ReviewQueueItem>(`/api/review-queue/${itemId}/review`, {
    method: 'POST',
    body: JSON.stringify(payload),
    ...auth,
  });
}

export async function getReviewQueueStats(auth: AuthContext): Promise<ReviewQueueStats> {
  return apiFetch<ReviewQueueStats>('/api/review-queue/stats', auth);
}

// ─── Workflows ────────────────────────────────────────────────────────────────

export async function listWorkflows(auth: AuthContext): Promise<WorkflowListResponse> {
  return apiFetch<WorkflowListResponse>('/api/workflows', auth);
}

export async function createWorkflow(auth: AuthContext, payload: CreateWorkflowPayload): Promise<Workflow> {
  return apiFetch<Workflow>('/api/workflows', { method: 'POST', body: JSON.stringify(payload), ...auth });
}

export async function getWorkflow(auth: AuthContext, workflowId: string): Promise<Workflow> {
  return apiFetch<Workflow>(`/api/workflows/${workflowId}`, auth);
}

export async function updateWorkflow(auth: AuthContext, workflowId: string, payload: UpdateWorkflowPayload): Promise<Workflow> {
  return apiFetch<Workflow>(`/api/workflows/${workflowId}`, { method: 'PATCH', body: JSON.stringify(payload), ...auth });
}

export async function deleteWorkflow(auth: AuthContext, workflowId: string): Promise<void> {
  await apiFetch<unknown>(`/api/workflows/${workflowId}`, { method: 'DELETE', ...auth });
}

export async function getDocumentPipelineInspect(
  auth: AuthContext,
  documentId: string,
): Promise<PipelineInspectReport> {
  return apiFetch<PipelineInspectReport>(`/api/documents/${documentId}/pipeline-inspect`, {
    method: 'GET',
    ...auth,
  });
}

export async function getPipelinePerformanceProfile(
  auth: AuthContext,
  documentId: string,
): Promise<PipelinePerformanceProfile> {
  return apiFetch<PipelinePerformanceProfile>(`/api/performance/pipeline-profile/${documentId}`, {
    method: 'GET',
    ...auth,
  });
}

export async function getPipelineConfig(auth: AuthContext): Promise<PipelineConfig> {
  return apiFetch<PipelineConfig>('/api/performance/pipeline-config', {
    method: 'GET',
    ...auth,
  });
}
