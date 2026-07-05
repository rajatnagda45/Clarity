'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

import { listBenchmarkSuggestions, scanBenchmarkSuggestions, dismissSuggestion } from '@/lib/api';
import type { BenchmarkSuggestion } from '@/types/clarity';
import { useWorkspace } from '@/contexts/WorkspaceContext';

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-700',
  dismissed: 'bg-slate-100 text-slate-500',
};

const REASON_LABELS: Record<string, string> = {
  low_trust: 'Low trust',
  low_judge: 'Low judge score',
  high_hallucination: 'High hallucination',
  abstention: 'Abstained',
};

export default function BenchmarkSuggestionsPage() {
  const searchParams = useSearchParams();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = searchParams.get('workspace') || activeWorkspace?.id || '';
  const { getToken } = useAuth();

  const [suggestions, setSuggestions] = useState<BenchmarkSuggestion[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  async function load() {
    if (!workspaceId) { setLoadState('error'); setError('Workspace required.'); return; }
    setLoadState('loading');
    try {
      const token = await getToken();
      if (!token) throw new Error('No session token.');
      const data = await listBenchmarkSuggestions({ token, workspaceId });
      setSuggestions(data.suggestions);
      setLoadState('loaded');
    } catch (err) {
      setLoadState('error');
      setError(err instanceof Error ? err.message : 'Failed to load suggestions.');
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [workspaceId]);

  async function handleScan() {
    setScanning(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('No session token.');
      await scanBenchmarkSuggestions({ token, workspaceId });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed.');
    } finally {
      setScanning(false);
    }
  }

  async function handleDismiss(id: string) {
    setActing(id);
    try {
      const token = await getToken();
      if (!token) throw new Error('No session token.');
      await dismissSuggestion({ token, workspaceId }, id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dismiss failed.');
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-600">Quality Improvement</p>
          <h1 className="text-3xl font-semibold text-slate-900">Benchmark Suggestions</h1>
          <p className="text-sm text-slate-600">
            Weak answers auto-identified for promotion to benchmark cases. Developer approval required — never auto-promoted.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void handleScan()}
            disabled={scanning || !workspaceId}
            className="inline-flex rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {scanning ? 'Scanning…' : 'Scan answers'}
          </button>
          <Link href={`/developer/dashboard?workspace=${encodeURIComponent(workspaceId)}`} className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">← Dashboard</Link>
        </div>
      </div>

      {loadState === 'loading' && <p className="text-sm text-slate-500">Loading suggestions…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {loadState === 'loaded' && suggestions.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center">
          <p className="text-sm text-slate-500">No suggestions yet. Run a scan to identify weak answers worth benchmarking.</p>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="grid gap-3">
          {suggestions.map((s) => (
            <article key={s.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[s.status]}`}>{s.status}</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                    {REASON_LABELS[s.suggestedReason] ?? s.suggestedReason}
                  </span>
                </div>
                <span className="text-xs text-slate-400">{new Date(s.createdAt).toLocaleString()}</span>
              </div>
              <p className="mt-3 text-sm font-medium text-slate-800">{s.question}</p>
              {s.approvedCaseId && (
                <p className="mt-1 text-xs text-green-600">Promoted to case: <span className="font-mono">{s.approvedCaseId}</span></p>
              )}
              {s.status === 'pending' && (
                <div className="mt-3 flex gap-2">
                  <button
                    disabled
                    title="Use the API to approve and set expected_answer"
                    className="rounded-full bg-green-600 px-3 py-1 text-xs font-medium text-white opacity-40 cursor-not-allowed"
                  >
                    Approve (API only)
                  </button>
                  <button
                    onClick={() => void handleDismiss(s.id)}
                    disabled={acting === s.id}
                    className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {acting === s.id ? 'Dismissing…' : 'Dismiss'}
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
