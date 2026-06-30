'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Badge } from '@/components/ds/Badge';
import { Skeleton } from '@/components/ds/Skeleton';
import { EmptyState } from '@/components/ds/EmptyState';
import { listContradictions } from '@/lib/api';
import type { Contradiction } from '@/types/clarity';

export default function ContradictionsPage() {
  const { getToken } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [contradictions, setContradictions] = useState<Contradiction[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeWorkspace) return;
    setLoading(true);
    getToken().then(async (token) => {
      if (!token) return;
      try {
        const data = await listContradictions({ token, workspaceId: activeWorkspace.id });
        setContradictions(data);
      } finally {
        setLoading(false);
      }
    });
  }, [activeWorkspace, getToken]);

  return (
      <div className="mx-auto w-full max-w-3xl px-6 py-8 flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Contradiction Map</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Cross-document conflicts detected by the Clarity verification engine.
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : contradictions.length === 0 ? (
          <EmptyState
            title="No contradictions found"
            description="Clarity will flag cross-document conflicts as your corpus grows."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {contradictions.map((c) => (
              <div
                key={c.id}
                className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-[var(--color-text-primary)]">{c.topic}</span>
                  <Badge variant={c.severity === 'major' ? 'error' : 'warning'} size="sm">
                    {c.severity}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-[var(--color-bg-elevated)] p-3">
                    <p className="text-2xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Document A</p>
                    <p className="mt-1 font-mono text-xs text-[var(--color-text-secondary)]">{c.docA}</p>
                    {c.valueA && <p className="mt-1 text-xs text-[var(--color-text-primary)]">{c.valueA}</p>}
                  </div>
                  <div className="rounded-xl bg-[var(--color-bg-elevated)] p-3">
                    <p className="text-2xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Document B</p>
                    <p className="mt-1 font-mono text-xs text-[var(--color-text-secondary)]">{c.docB}</p>
                    {c.valueB && <p className="mt-1 text-xs text-[var(--color-text-primary)]">{c.valueB}</p>}
                  </div>
                </div>
                {c.note && (
                  <p className="text-xs text-[var(--color-text-secondary)]">{c.note}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
  );
}
