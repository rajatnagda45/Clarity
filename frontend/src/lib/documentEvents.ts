'use client';

/**
 * Fetch-based SSE client for the document pipeline event stream.
 *
 * We use fetch (not native EventSource) so we can send Authorization and
 * X-Workspace-Id headers, which EventSource does not support.
 */

const BACKEND_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_BACKEND_URL) ||
  'http://localhost:8000';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Per-stage wall-clock durations (ms). All fields are optional — only stages
 *  that have completed appear in the snapshot. */
export interface StageTimings {
  fetch_ms?: number;
  extract_ms?: number;
  normalize_ms?: number;
  preprocess_ms?: number;
  chunk_ms?: number;
  persist_ms?: number;
  build_pending_ms?: number;
  embed_ms?: number;
  load_records_ms?: number;
  upsert_ms?: number;
  cleanup_ms?: number;
}

/** Snapshot of the worker process that processed this event. */
export interface WorkerInfo {
  pid: number;
  hostname: string;
  memory_mb: number;
  cpu_percent: number;
  worker_version: string;
  build: string;
}

export interface PipelineEvent {
  document_id: string;
  workspace_id: string;
  /** User-visible stage name */
  stage:
    | 'queued'
    | 'extracting'
    | 'normalizing'
    | 'clause_extraction'
    | 'chunking'
    | 'embedding'
    | 'indexing'
    | 'completed'
    | 'failed'
    | string;
  /** Internal DB status */
  status: string;
  /** 0–100, computed dynamically for batch stages */
  progress: number;
  elapsed_ms: number;
  worker: string;
  retry_count: number;
  timestamp: string;
  filename?: string;
  error?: string;
  stage_timings?: StageTimings;
  worker_info?: WorkerInfo;
}

/** Sent on SSE connect: last 100 historical events for replay. */
export interface HistoryEvent {
  type: 'history';
  workspace_id: string;
  timestamp: string;
  events: Array<PipelineEvent & { created_at?: string }>;
}

/** Sent after history: current in-progress documents. */
export interface ConnectedSnapshot {
  type: 'connected';
  workspace_id: string;
  timestamp: string;
  documents: Array<{
    document_id: string;
    workspace_id: string;
    filename?: string;
    stage: string;
    status: string;
    progress: number;
  }>;
}

export type SSEMessage = PipelineEvent | HistoryEvent | ConnectedSnapshot;

// ---------------------------------------------------------------------------
// Stream client
// ---------------------------------------------------------------------------

/**
 * Opens a persistent SSE connection to GET /api/events/documents.
 * Uses fetch (not native EventSource) to support auth headers.
 *
 * @returns A cancel function — call it to abort and close the stream.
 */
export function openDocumentEventStream(
  workspaceId: string,
  token: string,
  handlers: {
    onEvent: (msg: SSEMessage) => void;
    onConnect: () => void;
    onDisconnect: () => void;
  },
): () => void {
  const controller = new AbortController();

  const run = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/events/documents`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Workspace-Id': workspaceId,
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        handlers.onDisconnect();
        return;
      }

      handlers.onConnect();

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
          if (line.startsWith('data: ')) {
            const text = line.slice(6).trim();
            if (!text) continue;
            try {
              const parsed = JSON.parse(text) as SSEMessage;
              if ('error' in parsed && typeof (parsed as unknown as Record<string, unknown>).error === 'string') {
                continue; // skip error frames
              }
              handlers.onEvent(parsed);
            } catch {
              // ignore malformed frames
            }
          }
          // ": ping" comment lines are silently ignored
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
    }
    handlers.onDisconnect();
  };

  run();
  return () => controller.abort();
}
