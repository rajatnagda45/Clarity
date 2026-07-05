'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

import { listExperiments } from '@/lib/api';
import type { Experiment } from '@/types/clarity';
import { useWorkspace } from '@/contexts/WorkspaceContext';

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  archived: 'bg-slate-100 text-slate-600',
};

export default function ExperimentsPage() {
  const searchParams = useSearchParams();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = searchParams.get('workspace') || activeWorkspace?.id || '';
  const { getToken } = useAuth();

  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!workspaceId) { setLoadState('error'); setError('Workspace required.'); return; }
      setLoadState('loading');
      try {
        const token = await getToken();
        if (!token) throw new Error('No session token.');
        const data = await listExperiments({ token, workspaceId });
        if (!cancelled) { setExperiments(data.experiments); setLoadState('loaded'); }
      } catch (err) {
        if (!cancelled) { setLoadState('error'); setError(err instanceof Error ? err.message : 'Failed to load experiments.'); }
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [getToken, workspaceId]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-600">Quality Improvement</p>
          <h1 className="text-3xl font-semibold text-slate-900">Experiments</h1>
          <p className="text-sm text-slate-600">Compare prompt versions, retrieval strategies, and models in head-to-head experiments.</p>
        </div>
        <Link
          href={`/developer/dashboard?workspace=${encodeURIComponent(workspaceId)}`}
          className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
        >
          ← Dashboard
        </Link>
      </div>

      {loadState === 'loading' && <p className="text-sm text-slate-500">Loading experiments…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {loadState === 'loaded' && experiments.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center">
          <p className="text-sm text-slate-500">No experiments yet. Create one via the API to compare prompt or model versions.</p>
        </div>
      )}

      {experiments.length > 0 && (
        <div className="grid gap-4">
          {experiments.map((exp) => (
            <article key={exp.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{exp.name}</p>
                  {exp.description && <p className="mt-1 text-sm text-slate-600">{exp.description}</p>}
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[exp.status] ?? ''}`}>
                  {exp.status}
                </span>
              </div>

              <div className="mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
                {exp.candidates.map((c) => (
                  <div key={c.id} className="rounded-xl bg-slate-50 p-3">
                    <p className="font-medium text-slate-900">{c.name}</p>
                    <p className="text-xs text-slate-500 mt-1">Model: <span className="font-mono">{c.modelVersion}</span></p>
                    <p className="text-xs text-slate-500">Prompt: <span className="font-mono">{c.promptVersion}</span></p>
                    {c.avgJudgeOverall !== null && (
                      <p className="text-xs text-slate-700 mt-2">Avg judge: <span className="font-semibold">{c.avgJudgeOverall?.toFixed(1)}</span></p>
                    )}
                    <p className="text-xs text-slate-400 mt-1">{c.evalCount} eval(s)</p>
                  </div>
                ))}
              </div>

              {exp.winnerCandidateId && (
                <p className="mt-3 text-xs text-green-700 font-medium">
                  Winner: {exp.candidates.find((c) => c.id === exp.winnerCandidateId)?.name ?? exp.winnerCandidateId}
                </p>
              )}
              <p className="mt-2 text-xs text-slate-400">Created {new Date(exp.createdAt).toLocaleString()}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
