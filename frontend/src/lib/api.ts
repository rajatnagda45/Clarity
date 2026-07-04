/**
 * Typed API client for the Clarity backend.
 *
 * All requests attach the Clerk session token and the active workspace id.
 * Use `streamQuery` for SSE-based query responses.
 */

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
  ApiError,
  MeResponse,
  Workspace,
  AnswerExplorerResponse,
  AnswerMetrics,
  Citation,
  SpanRef,
  WorkspaceMember,
  MembersListResponse,
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

async function parseApiError(response: Response): Promise<Error> {
  const err = await response
    .json()
    .catch(() => ({ error: response.statusText })) as ApiError | { detail?: unknown };

  if ('detail' in err && err.detail && typeof err.detail === 'object' && 'message' in err.detail) {
    return new Error(String((err.detail as { message: string }).message));
  }

  if ('detail' in err && typeof err.detail === 'string') {
    return new Error(err.detail);
  }

  if ('error' in err && err.error) {
    if (typeof err.error === 'string') {
      return new Error(err.error);
    }

    if (typeof err.error === 'object' && err.error && 'message' in err.error) {
      return new Error(String(err.error.message));
    }
  }

  return new Error(response.statusText);
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
): Promise<{ url: string }> {
  return apiFetch<{ url: string }>('/api/billing/checkout', {
    method: 'POST',
    body: JSON.stringify({ plan, success_url: successUrl, cancel_url: cancelUrl }),
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
// Eval metrics
// ---------------------------------------------------------------------------
export async function getEvalMetrics(
  auth: AuthContext,
  suite: 'golden' | 'adversarial' = 'golden',
): Promise<EvalMetrics[]> {
  return apiFetch<EvalMetrics[]>(`/api/eval/metrics?suite=${suite}`, { method: 'GET', ...auth });
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
// B4: Model Comparisons
// ---------------------------------------------------------------------------
export async function listModelComparisons(auth: AuthContext): Promise<import('@/types/clarity').ModelComparisonListResponse> {
  return apiFetch('/api/model-comparisons', { method: 'GET', ...auth });
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
