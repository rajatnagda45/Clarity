'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

import { listQualityGateRules, listQualityGateRuns } from '@/lib/api';
import type { QualityGateRule, QualityGateRun } from '@/types/clarity';

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

export default function QualityGatesPage() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get('workspace') ?? '';
  const { getToken } = useAuth();

  const [rules, setRules] = useState<QualityGateRule[]>([]);
  const [runs, setRuns] = useState<QualityGateRun[]>([]);
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
        const [rulesData, runsData] = await Promise.all([
          listQualityGateRules({ token, workspaceId }),
          listQualityGateRuns({ token, workspaceId }),
        ]);
        if (!cancelled) {
          setRules(rulesData);
          setRuns(runsData.runs);
          setLoadState('loaded');
        }
      } catch (err) {
        if (!cancelled) { setLoadState('error'); setError(err instanceof Error ? err.message : 'Failed to load.'); }
      }
    }

    void load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-600">Quality Improvement</p>
          <h1 className="text-3xl font-semibold text-slate-900">Quality Gates</h1>
          <p className="text-sm text-slate-600">Configurable pass/fail rules evaluated against benchmark runs to gate releases.</p>
        </div>
        <Link href={`/developer/dashboard?workspace=${encodeURIComponent(workspaceId)}`} className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">← Dashboard</Link>
      </div>

      {loadState === 'loading' && <p className="text-sm text-slate-500">Loading quality gates…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {loadState === 'loaded' && (
        <>
          {/* Rules */}
          <section>
            <h2 className="mb-3 text-base font-semibold text-slate-800">Active Rules</h2>
            {rules.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
                <p className="text-sm text-slate-500">No rules yet. POST to /api/quality-gates/rules to create one.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Name</th>
                      <th className="px-4 py-3 text-left">Metric</th>
                      <th className="px-4 py-3 text-left">Operator</th>
                      <th className="px-4 py-3 text-right">Threshold</th>
                      <th className="px-4 py-3 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {rules.map((rule) => (
                      <tr key={rule.id}>
                        <td className="px-4 py-3 font-medium text-slate-900">{rule.name}</td>
                        <td className="px-4 py-3 font-mono text-slate-600">{rule.metric}</td>
                        <td className="px-4 py-3 font-mono text-slate-600">{rule.operator}</td>
                        <td className="px-4 py-3 text-right font-mono text-slate-700">{rule.threshold}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${rule.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                            {rule.active ? 'active' : 'inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Gate Runs */}
          <section>
            <h2 className="mb-3 text-base font-semibold text-slate-800">Gate Run History</h2>
            {runs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
                <p className="text-sm text-slate-500">No gate runs yet. POST to /api/quality-gates/run to evaluate.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {runs.map((run) => (
                  <article key={run.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${run.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {run.passed ? 'PASSED' : 'FAILED'}
                        </span>
                        <span className="text-sm text-slate-600">
                          {run.rulesPassed}/{run.rulesEvaluated} rules passed
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">{new Date(run.createdAt).toLocaleString()}</span>
                    </div>
                    {run.details.length > 0 && (
                      <div className="mt-3 grid gap-1">
                        {run.details.map((d, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span className={d.passed ? 'text-green-600' : 'text-red-600'}>{d.passed ? '✓' : '✗'}</span>
                            <span className="font-medium text-slate-700">{d.ruleName}</span>
                            <span className="text-slate-400">{d.note}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
