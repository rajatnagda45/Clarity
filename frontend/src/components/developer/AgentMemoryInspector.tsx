'use client';

/**
 * AgentMemoryInspector — visualises the StepMemory window for a run.
 *
 * Shows role, content, tool, and timestamp. Entries are colour-coded by
 * role (system, user, assistant, tool, observation). The "global" tab
 * surfaces episodic entries that were persisted for future runs.
 */
import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Brain, Loader2, ScrollText, Wrench } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { getAgentRunMemory } from '@/lib/api';
import type { AuthContext } from '@/lib/api';
import type { AgentRunMemory } from '@/types/clarity';
import { cn } from '@/lib/cn';

export function AgentMemoryInspector({ runId }: { runId: string }) {
  const { getToken } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [entries, setEntries] = useState<AgentRunMemory[]>([]);
  const [scope, setScope] = useState<'run' | 'global' | 'all'>('all');
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
      const res = await getAgentRunMemory(auth, runId, scope === 'all' ? undefined : scope);
      setEntries(res.entries);
    } finally {
      setLoading(false);
    }
  }, [getAuth, runId, scope]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-surface-elevated p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-fg-primary">
          <Brain className="h-4 w-4 text-accent" /> Memory
        </h3>
        <div className="flex gap-1 rounded-lg bg-white/[0.04] p-0.5 text-[11px]">
          {(['all', 'run', 'global'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              className={cn(
                'rounded px-2 py-1 transition-colors',
                scope === s ? 'bg-accent text-white' : 'text-fg-muted hover:text-fg-primary',
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-fg-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading memory…
        </div>
      ) : entries.length === 0 ? (
        <div className="text-fg-muted">No memory entries for this scope.</div>
      ) : (
        <ol className="space-y-2">
          {entries.map((e, i) => (
            <motion.li
              key={e.id ?? i}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.015 }}
              className={cn(
                'rounded-lg border p-3',
                e.scope === 'global' ? 'border-accent/30 bg-accent/5' : 'border-white/[0.06] bg-black/20',
              )}
            >
              <div className="mb-1 flex items-center gap-2 text-[11px] text-fg-muted">
                <RolePill role={e.role} />
                {e.tool && (
                  <span className="inline-flex items-center gap-1 rounded bg-white/[0.04] px-1.5 py-0.5">
                    <Wrench className="h-3 w-3" /> {e.tool}
                  </span>
                )}
                {e.scope === 'global' && (
                  <span className="rounded bg-accent/15 px-1.5 py-0.5 text-accent">global</span>
                )}
                <span className="ml-auto">{new Date(e.created_at).toLocaleTimeString()}</span>
              </div>
              <p className="whitespace-pre-wrap text-xs text-fg-secondary">{e.content}</p>
            </motion.li>
          ))}
        </ol>
      )}
    </div>
  );
}

function RolePill({ role }: { role: AgentRunMemory['role'] }) {
  const color = {
    system: 'bg-fg-muted/15 text-fg-secondary',
    user: 'bg-accent/15 text-accent',
    assistant: 'bg-success/15 text-success',
    tool: 'bg-warning/15 text-warning',
    observation: 'bg-fg-muted/15 text-fg-secondary',
  }[role];
  const Icon = role === 'assistant' ? Brain : ScrollText;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5', color)}>
      <Icon className="h-3 w-3" /> {role}
    </span>
  );
}
