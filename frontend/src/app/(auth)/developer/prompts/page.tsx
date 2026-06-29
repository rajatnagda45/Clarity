'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

import { listPromptVersions, activatePromptVersion } from '@/lib/api';
import type { PromptVersion } from '@/types/clarity';

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

const KEY_COLORS: Record<string, string> = {
  writer: 'bg-blue-100 text-blue-800',
  critic: 'bg-amber-100 text-amber-800',
  judge: 'bg-purple-100 text-purple-800',
};

export default function PromptsPage() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get('workspace') ?? '';
  const { getToken } = useAuth();

  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [error, setError] = useState('');
  const [activating, setActivating] = useState<string | null>(null);

  async function load() {
    if (!workspaceId) { setLoadState('error'); setError('Workspace required.'); return; }
    setLoadState('loading');
    try {
      const token = await getToken();
      if (!token) throw new Error('No session token.');
      const data = await listPromptVersions({ token, workspaceId });
      setVersions(data.versions);
      setLoadState('loaded');
    } catch (err) {
      setLoadState('error');
      setError(err instanceof Error ? err.message : 'Failed to load prompt versions.');
    }
  }

  useEffect(() => {
    void load();
  }, [workspaceId]);

  async function handleActivate(promptId: string) {
    setActivating(promptId);
    try {
      const token = await getToken();
      if (!token) throw new Error('No session token.');
      await activatePromptVersion({ token, workspaceId }, promptId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Activation failed.');
    } finally {
      setActivating(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-600">Quality Improvement</p>
          <h1 className="text-3xl font-semibold text-slate-900">Prompt Versions</h1>
          <p className="text-sm text-slate-600">Track, compare, and activate prompt versions across writer, critic, and judge roles.</p>
        </div>
        <Link href={`/developer/dashboard?workspace=${encodeURIComponent(workspaceId)}`} className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">← Dashboard</Link>
      </div>

      {loadState === 'loading' && <p className="text-sm text-slate-500">Loading prompt versions…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {loadState === 'loaded' && versions.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center">
          <p className="text-sm text-slate-500">No prompt versions yet. POST to /api/prompts to add one.</p>
        </div>
      )}

      {versions.length > 0 && (
        <div className="grid gap-3">
          {versions.map((v) => (
            <article key={v.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${KEY_COLORS[v.promptKey] ?? 'bg-slate-100 text-slate-700'}`}>{v.promptKey}</span>
                  <p className="font-mono text-sm font-semibold text-slate-900">{v.version}</p>
                  {v.active && <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 font-medium">active</span>}
                </div>
                {!v.active && !v.retired && (
                  <button
                    onClick={() => void handleActivate(v.id)}
                    disabled={activating === v.id}
                    className="rounded-full border border-blue-300 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                  >
                    {activating === v.id ? 'Activating…' : 'Activate'}
                  </button>
                )}
              </div>
              {v.description && <p className="mt-2 text-sm text-slate-600">{v.description}</p>}
              {v.author && <p className="mt-1 text-xs text-slate-400">By {v.author}</p>}
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-700">Show content</summary>
                <pre className="mt-2 overflow-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-700 whitespace-pre-wrap">{v.content}</pre>
              </details>
              <p className="mt-2 text-xs text-slate-400">{new Date(v.createdAt).toLocaleString()}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
