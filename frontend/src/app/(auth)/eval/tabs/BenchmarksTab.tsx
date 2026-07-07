'use client';

import { Loader2 } from 'lucide-react';
import { Target } from 'lucide-react';
import Link from 'next/link';
import { EvalEmptyState, LoadingGrid, SectionHeader } from './_shared';
import { useBenchmarkRuns } from '@/hooks/useBenchmarks';

const STATUS_COLOR: Record<string, string> = {
  completed: 'text-emerald-400 bg-emerald-400/10',
  running: 'text-blue-400 bg-blue-400/10',
  failed: 'text-red-400 bg-red-400/10',
  cancelled: 'text-[#4A5168] bg-white/[0.04]',
};

export function BenchmarksTab() {
  const { data: runs, isLoading } = useBenchmarkRuns();

  if (isLoading) return <LoadingGrid cols={1} rows={3} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionHeader title="Benchmark Runs" sub="All benchmark executions across datasets" />
        <Link href="/eval/benchmarks" className="px-4 py-2 rounded-xl bg-purple-500 text-white text-sm font-semibold hover:bg-purple-600 transition-colors">
          Manage Datasets →
        </Link>
      </div>

      {!runs?.length ? (
        <EvalEmptyState icon={Target} title="No benchmark runs yet" sub="Create a benchmark dataset and trigger your first run from the Benchmarks page." />
      ) : (
        <div className="space-y-3">
          {runs.map(run => {
            const pct = run.totalCases > 0 ? Math.round((run.completedCases / run.totalCases) * 100) : 0;
            return (
              <div key={run.id} className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-[#F1F3F9] font-mono">{run.id.slice(0, 8)}…</p>
                    <p className="text-xs text-[#4A5168] mt-0.5">{new Date(run.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {run.status === 'running' && <Loader2 size={14} className="animate-spin text-blue-400" />}
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_COLOR[run.status] ?? 'text-[#4A5168]'}`}>
                      {run.status}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4 text-xs mb-3">
                  <div><p className="text-[#4A5168]">Progress</p><p className="text-[#F1F3F9] font-medium">{run.completedCases}/{run.totalCases}</p></div>
                  <div><p className="text-[#4A5168]">Judge Score</p><p className="text-[#F1F3F9] font-medium">{run.avgJudgeOverall?.toFixed(1) ?? '—'}/10</p></div>
                  <div><p className="text-[#4A5168]">Trust</p><p className="text-[#F1F3F9] font-medium">{run.avgTrustConfidence != null ? `${(run.avgTrustConfidence * 100).toFixed(0)}%` : '—'}</p></div>
                  <div><p className="text-[#4A5168]">Latency</p><p className="text-[#F1F3F9] font-medium">{run.avgLatencyMs ? `${Math.round(run.avgLatencyMs)}ms` : '—'}</p></div>
                </div>
                {run.status === 'running' && (
                  <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
