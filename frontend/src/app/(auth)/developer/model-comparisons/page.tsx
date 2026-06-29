'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

import { listModelComparisons } from '@/lib/api';
import type { ModelComparison } from '@/types/clarity';

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export default function ModelComparisonsPage() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get('workspace') ?? '';
  const { getToken } = useAuth();

  const [comparisons, setComparisons] = useState<ModelComparison[]>([]);
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
        const data = await listModelComparisons({ token, workspaceId });
        if (!cancelled) { setComparisons(data.comparisons); setLoadState('loaded'); }
      } catch (err) {
        if (!cancelled) { setLoadState('error'); setError(err instanceof Error ? err.message : 'Failed to load model comparisons.'); }
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
          <h1 className="text-3xl font-semibold text-slate-900">Model Comparisons</h1>
          <p className="text-sm text-slate-600">Aggregate benchmark results by model version to compare quality and latency across runs.</p>
        </div>
        <Link href={`/developer/dashboard?workspace=${encodeURIComponent(workspaceId)}`} className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">← Dashboard</Link>
      </div>

      {loadState === 'loading' && <p className="text-sm text-slate-500">Loading model comparisons…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {loadState === 'loaded' && comparisons.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center">
          <p className="text-sm text-slate-500">No benchmark runs yet. Run benchmarks to compare models.</p>
        </div>
      )}

      {comparisons.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Model version</th>
                  <th className="px-4 py-3 text-right">Runs</th>
                  <th className="px-4 py-3 text-right">Cases</th>
                  <th className="px-4 py-3 text-right">Avg judge</th>
                  <th className="px-4 py-3 text-right">Avg trust</th>
                  <th className="px-4 py-3 text-right">Avg latency (ms)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {comparisons.map((c) => (
                  <tr key={c.modelVersion} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-slate-900">{c.modelVersion}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{c.runCount}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{c.totalCases}</td>
                    <td className="px-4 py-3 text-right">
                      {c.avgJudgeOverall !== null
                        ? <span className={`font-semibold ${c.avgJudgeOverall >= 80 ? 'text-green-700' : c.avgJudgeOverall >= 60 ? 'text-amber-700' : 'text-red-700'}`}>{c.avgJudgeOverall.toFixed(1)}</span>
                        : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.avgTrustConfidence !== null
                        ? <span className="text-slate-700">{(c.avgTrustConfidence * 100).toFixed(1)}%</span>
                        : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.avgLatencyMs !== null
                        ? <span className="text-slate-700">{c.avgLatencyMs.toFixed(0)}</span>
                        : <span className="text-slate-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Card view for mobile */}
          <div className="grid gap-3 md:hidden">
            {comparisons.map((c) => (
              <article key={c.modelVersion} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="font-mono text-sm font-semibold text-slate-900">{c.modelVersion}</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Stat label="Runs" value={String(c.runCount)} />
                  <Stat label="Cases" value={String(c.totalCases)} />
                  <Stat label="Avg judge" value={c.avgJudgeOverall !== null ? c.avgJudgeOverall.toFixed(1) : '—'} />
                  <Stat label="Avg trust" value={c.avgTrustConfidence !== null ? `${(c.avgTrustConfidence * 100).toFixed(1)}%` : '—'} />
                  <Stat label="Avg latency" value={c.avgLatencyMs !== null ? `${c.avgLatencyMs.toFixed(0)}ms` : '—'} />
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
