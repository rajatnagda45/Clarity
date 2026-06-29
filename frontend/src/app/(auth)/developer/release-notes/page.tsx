'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

import { listReleaseNotes } from '@/lib/api';
import type { ReleaseNote } from '@/types/clarity';

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

function DeltaBadge({ value }: { value: number }) {
  const positive = value > 0;
  const zero = value === 0;
  return (
    <span className={`text-xs font-medium ${zero ? 'text-slate-400' : positive ? 'text-green-600' : 'text-red-600'}`}>
      {positive ? '+' : ''}{value.toFixed(2)}
    </span>
  );
}

export default function ReleaseNotesPage() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get('workspace') ?? '';
  const { getToken } = useAuth();

  const [notes, setNotes] = useState<ReleaseNote[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!workspaceId) { setLoadState('error'); setError('Workspace required.'); return; }
    setLoadState('loading');
    let cancelled = false;

    async function load() {
      try {
        const token = await getToken();
        if (!token) throw new Error('No session token.');
        const data = await listReleaseNotes({ token, workspaceId });
        if (!cancelled) { setNotes(data.notes); setLoadState('loaded'); }
      } catch (err) {
        if (!cancelled) { setLoadState('error'); setError(err instanceof Error ? err.message : 'Failed to load release notes.'); }
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [workspaceId]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-600">Quality Improvement</p>
          <h1 className="text-3xl font-semibold text-slate-900">Release Notes</h1>
          <p className="text-sm text-slate-600">AI-generated summaries comparing model version performance across benchmark runs.</p>
        </div>
        <Link href={`/developer/dashboard?workspace=${encodeURIComponent(workspaceId)}`} className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">← Dashboard</Link>
      </div>

      {loadState === 'loading' && <p className="text-sm text-slate-500">Loading release notes…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {loadState === 'loaded' && notes.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center">
          <p className="text-sm text-slate-500">No release notes yet. POST to /api/release-notes to generate one.</p>
        </div>
      )}

      {notes.length > 0 && (
        <div className="grid gap-4">
          {notes.map((note) => (
            <article key={note.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-slate-900">{note.title}</h2>
                  <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                    {note.fromVersion && <><span className="font-mono">{note.fromVersion}</span><span>→</span></>}
                    <span className="font-mono">{note.toVersion}</span>
                  </div>
                </div>
                <span className="text-xs text-slate-400">{new Date(note.createdAt).toLocaleString()}</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-700">{note.summary}</p>
              {note.metricsDelta && Object.keys(note.metricsDelta).length > 0 && (
                <div className="mt-4 flex flex-wrap gap-4">
                  {Object.entries(note.metricsDelta).map(([key, val]) => (
                    <div key={key} className="text-xs">
                      <span className="text-slate-500">{key.replace(/_/g, ' ')}: </span>
                      <DeltaBadge value={val} />
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
