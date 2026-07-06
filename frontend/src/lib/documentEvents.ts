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
  /** 0–100 */
  progress: number;
  elapsed_ms: number;
  worker: string;
  retry_count: number;
  timestamp: string;
  filename?: string;
  error?: string;
}

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

export type SSEMessage = PipelineEvent | ConnectedSnapshot;

/**
 * Opens a persistent SSE connection to GET /api/events/documents.
 *
 * @returns A cancel function — call it to abort the stream.
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
              if ('error' in parsed) continue; // skip error frames
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
