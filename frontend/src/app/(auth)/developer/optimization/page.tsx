'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

import { listOptimizationRecommendations, runOptimizationAnalysis, updateRecommendation } from '@/lib/api';
import type { OptimizationRecommendation } from '@/types/clarity';

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

const SEVERITY_STYLES: Record<string, string> = {
  high: 'bg-red-100 text-red-800',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-slate-100 text-slate-600',
};

export default function OptimizationPage() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get('workspace') ?? '';
  const { getToken } = useAuth();

  const [recs, setRecs] = useState<OptimizationRecommendation[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [error, setError] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  async function load() {
    if (!workspaceId) { setLoadState('error'); setError('Workspace required.'); return; }
    setLoadState('loading');
    try {
      const token = await getToken();
      if (!token) throw new Error('No session token.');
      const data = await listOptimizationRecommendations({ token, workspaceId });
      setRecs(data.recommendations);
      setLoadState('loaded');
    } catch (err) {
      setLoadState('error');
      setError(err instanceof Error ? err.message : 'Failed to load recommendations.');
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [workspaceId]);

  async function handleAnalyze() {
    setAnalyzing(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('No session token.');
      const data = await runOptimizationAnalysis({ token, workspaceId });
      setRecs(data.recommendations);
      setLoadState('loaded');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed.');
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleStatus(recId: string, status: 'accepted' | 'dismissed') {
    setUpdating(recId);
    try {
      const token = await getToken();
      if (!token) throw new Error('No session token.');
      await updateRecommendation({ token, workspaceId }, recId, status);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed.');
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-600">Quality Improvement</p>
          <h1 className="text-3xl font-semibold text-slate-900">Optimization Recommendations</h1>
          <p className="text-sm text-slate-600">AI-generated prompt improvement suggestions based on evaluation history. Never applied automatically.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void handleAnalyze()}
            disabled={analyzing || !workspaceId}
            className="inline-flex rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {analyzing ? 'Analyzing…' : 'Run analysis'}
          </button>
          <Link href={`/developer/dashboard?workspace=${encodeURIComponent(workspaceId)}`} className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">← Dashboard</Link>
        </div>
      </div>

      {loadState === 'loading' && <p className="text-sm text-slate-500">Loading recommendations…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {loadState === 'loaded' && recs.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center">
          <p className="text-sm text-slate-500">No pending recommendations. Run analysis after accumulating evaluations.</p>
        </div>
      )}

      {recs.length > 0 && (
        <div className="grid gap-3">
          {recs.map((rec) => (
            <article key={rec.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${SEVERITY_STYLES[rec.severity]}`}>{rec.severity}</span>
                  <span className="font-mono text-xs text-slate-500">{rec.dimension}</span>
                </div>
                <span className={`text-xs font-medium ${rec.status === 'pending' ? 'text-slate-500' : rec.status === 'accepted' ? 'text-green-700' : 'text-slate-400'}`}>{rec.status}</span>
              </div>
              <p className="mt-3 text-sm text-slate-800">{rec.recommendation}</p>
              {rec.evidence && (
                <p className="mt-1 text-xs text-slate-400">
                  Avg score: {(rec.evidence as Record<string, number>)?.avg_score?.toFixed(1) ?? 'n/a'} (window: {(rec.evidence as Record<string, number>)?.window})
                </p>
              )}
              {rec.status === 'pending' && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => void handleStatus(rec.id, 'accepted')}
                    disabled={updating === rec.id}
                    className="rounded-full bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => void handleStatus(rec.id, 'dismissed')}
                    disabled={updating === rec.id}
                    className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Dismiss
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
