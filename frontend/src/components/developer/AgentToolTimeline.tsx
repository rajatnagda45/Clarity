'use client';

/**
 * AgentToolTimeline — chronological list of tool calls for an agent run.
 *
 * Reuses the same dark-glass primitives as the rest of the dev console.
 * Each row shows: tool name, input preview, status, latency, tokens, cost,
 * retry count. Failed/timeout rows are expanded by default.
 */
import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Clock, Loader2, Wrench, XCircle } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { listAgentRunToolCalls } from '@/lib/api';
import type { AuthContext } from '@/lib/api';
import { cn } from '@/lib/cn';

export function AgentToolTimeline({ runId }: { runId: string }) {
  const { getToken } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [toolCalls, setToolCalls] = useState<Array<Record<string, any>>>([]);
  const [loading, setLoading] = useState(true);

  const getAuth = useCallback(async (): Promise<AuthContext | null> => {
    const token = await getToken();
    if (!token || !activeWorkspace?.id) return null;
    return { token, workspaceId: activeWorkspace.id };
  }, [getToken, activeWorkspace?.id]);

  const load = useCallback(async () => {
    const auth = await getAuth();
    if (!auth) return;
    setLoading(true);
    try {
      const res = await listAgentRunToolCalls(auth, runId);
      setToolCalls(res.tool_calls);
    } finally {
      setLoading(false);
    }
  }, [getAuth, runId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-white/[0.06] bg-surface-elevated p-4 text-fg-secondary">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading tool calls…
      </div>
    );
  }
  if (toolCalls.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-surface-elevated p-4 text-fg-muted">
        No tool calls were made in this run.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-surface-elevated p-4">
      <h3 className="mb-3 text-sm font-semibold text-fg-primary">
        Tool timeline <span className="text-fg-muted">({toolCalls.length})</span>
      </h3>
      <ol className="relative space-y-2 border-l border-white/[0.06] pl-4">
        {toolCalls.map((tc, i) => (
          <motion.li
            key={(tc.id as string) ?? i}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.02 }}
            className="relative"
          >
            <span
              className={cn(
                'absolute -left-[19px] top-3 h-2.5 w-2.5 rounded-full ring-4 ring-surface-elevated',
                tc.status === 'success' ? 'bg-success' : tc.status === 'timeout' ? 'bg-warning' : 'bg-danger',
              )}
            />
            <ToolCallRow tc={tc} />
          </motion.li>
        ))}
      </ol>
    </div>
  );
}

function ToolCallRow({ tc }: { tc: Record<string, any> }) {
  const expanded = tc.status !== 'success';
  return (
    <details open={expanded} className="rounded-lg border border-white/[0.06] bg-black/20 p-3">
      <summary className="flex cursor-pointer items-center gap-2">
        <Wrench className="h-3.5 w-3.5 text-accent" />
        <span className="text-sm font-medium text-fg-primary">{tc.tool_name as string}</span>
        <StatusPill status={tc.status as string} />
        <span className="ml-auto inline-flex items-center gap-3 text-[11px] text-fg-muted">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" /> {tc.latency_ms as number} ms
          </span>
        </span>
      </summary>
      <div className="mt-2 space-y-2 text-xs">
        <Row label="Input" value={JSON.stringify(tc.input ?? {}, null, 2)} mono />
        {tc.output && <Row label="Output" value={JSON.stringify(tc.output, null, 2)} mono />}
        {tc.error_message && <Row label="Error" value={tc.error_message as string} danger />}
        {tc.error_kind && <Row label="Error kind" value={tc.error_kind as string} />}
      </div>
    </details>
  );
}

function Row({ label, value, mono = false, danger = false }: { label: string; value: string; mono?: boolean; danger?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-fg-muted">{label}</div>
      <pre
        className={cn(
          'mt-1 max-h-48 overflow-auto rounded p-2 text-[11px]',
          mono ? 'font-mono' : 'whitespace-pre-wrap',
          danger ? 'bg-danger/5 text-danger' : 'bg-black/30 text-fg-secondary',
        )}
      >
        {value}
      </pre>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === 'success') {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-success/15 px-1.5 py-0.5 text-[10px] text-success">
        <CheckCircle2 className="h-3 w-3" /> success
      </span>
    );
  }
  if (status === 'timeout') {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-warning/15 px-1.5 py-0.5 text-[10px] text-warning">
        <Clock className="h-3 w-3" /> timeout
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded bg-danger/15 px-1.5 py-0.5 text-[10px] text-danger">
      <XCircle className="h-3 w-3" /> {status}
    </span>
  );
}
