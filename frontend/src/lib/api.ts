/**
 * Typed API client for the Clarity backend.
 *
 * All requests attach the Clerk session token and the active workspace id.
 * Use `streamQuery` for SSE-based query responses.
 */

import type {
  Document,
  Conversation,
  Message,
  Contradiction,
  EvalMetrics,
  StreamEvent,
  ApiError,
  MeResponse,
  Workspace,
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
    const err: ApiError = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.detail ?? err.error);
  }

  return response.json() as Promise<T>;
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
// Documents
// ---------------------------------------------------------------------------
export async function listDocuments(auth: AuthContext): Promise<Document[]> {
  return apiFetch<Document[]>('/api/documents', { method: 'GET', ...auth });
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
    const err: ApiError = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.detail ?? err.error);
  }

  return response.json() as Promise<Document>;
}

// ---------------------------------------------------------------------------
// Conversations + Messages
// ---------------------------------------------------------------------------
export async function listConversations(auth: AuthContext): Promise<Conversation[]> {
  return apiFetch<Conversation[]>('/api/conversations', { method: 'GET', ...auth });
}

export async function getConversation(
  auth: AuthContext,
  conversationId: string,
): Promise<{ conversation: Conversation; messages: Message[] }> {
  return apiFetch(`/api/conversations/${conversationId}`, { method: 'GET', ...auth });
}

// ---------------------------------------------------------------------------
// Query — SSE stream
// ---------------------------------------------------------------------------
export function streamQuery(
  auth: AuthContext,
  payload: { question: string; documentIds: string[]; conversationId?: string },
  onEvent: (event: StreamEvent) => void,
  onError: (err: Error) => void,
): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/query`, {
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
        const err: ApiError = await response.json().catch(() => ({ error: response.statusText }));
        onError(new Error(err.detail ?? err.error));
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
