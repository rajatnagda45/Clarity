'use client';

import { lazy, Suspense, useMemo } from 'react';
import { Brain, Trophy } from 'lucide-react';
import { PremiumBackground } from '@/components/landing/PremiumBackground';
import { useModelComparisons } from '@/hooks/useRegressions';

const ModelCharts = lazy(() => import('./ModelCharts').then(m => ({ default: m.ModelCharts })));

const MODEL_COLORS = ['#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#EC4899'];

function MetricBadge({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div className="text-center">
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-[#4A5168] mt-0.5">{label}</p>
    </div>
  );
}

function ChartsSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="h-72 bg-white/[0.03] border border-white/[0.04] rounded-2xl animate-pulse" />
      <div className="h-72 bg-white/[0.03] border border-white/[0.04] rounded-2xl animate-pulse" />
    </div>
  );
}

export default function ModelComparisonsPage() {
  const { data, isLoading, isError } = useModelComparisons();
  const comparisons = useMemo(() => data?.comparisons ?? [], [data?.comparisons]);

  return (
    <div className="relative min-h-screen bg-[#05070B] selection:bg-purple-500/30 selection:text-white pb-32">
      <PremiumBackground glowOpacity={0.07} />

      <div className="relative z-10 mx-auto max-w-[1400px] px-6 pt-10 pb-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#F1F3F9] tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Brain size={20} className="text-purple-400" />
            </div>
            Model Comparisons
          </h1>
          <p className="text-sm text-[#8892AA] mt-1.5">Aggregate benchmark results by model version — judge score, trust confidence, and latency.</p>
        </div>

        {isLoading && (
          <div className="space-y-6">
            <ChartsSkeleton />
            <div className="h-56 bg-white/[0.03] border border-white/[0.04] rounded-2xl animate-pulse" />
          </div>
        )}

        {isError && (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm text-red-400">Failed to load model comparisons.</p>
          </div>
        )}

        {!isLoading && !isError && comparisons.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-[#0F1117] border border-white/[0.06] rounded-2xl">
            <Brain size={40} className="text-[#4A5168] mb-4" />
            <p className="text-base font-semibold text-[#F1F3F9]">No model comparison data yet</p>
            <p className="text-sm text-[#4A5168] mt-1 max-w-sm">Complete benchmark runs using different model versions to see comparisons here.</p>
          </div>
        )}

        {!isLoading && comparisons.length > 0 && (
          <div className="space-y-8">
            <Suspense fallback={<ChartsSkeleton />}>
              <ModelCharts comparisons={comparisons} modelColors={MODEL_COLORS} />
            </Suspense>

            <div>
              <p className="text-sm font-semibold text-[#F1F3F9] mb-4">Full Leaderboard</p>
              <div className="space-y-3">
                {comparisons.map((c, i) => (
                  <div key={c.modelVersion} className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-5 flex items-center gap-5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${
                      i === 0 ? 'bg-amber-500/20 text-amber-400' :
                      i === 1 ? 'bg-slate-400/20 text-slate-400' :
                      i === 2 ? 'bg-orange-700/20 text-orange-400' :
                      'bg-white/[0.04] text-[#4A5168]'
                    }`}>
                      {i === 0 ? <Trophy size={16} /> : i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono font-semibold text-[#F1F3F9] truncate">{c.modelVersion}</p>
                      <p className="text-xs text-[#4A5168] mt-0.5">{c.runCount} run{c.runCount !== 1 ? 's' : ''} · {c.totalCases} cases evaluated</p>
                    </div>
                    <div className="flex items-center gap-8 shrink-0">
                      <MetricBadge
                        value={c.avgJudgeOverall?.toFixed(2) ?? '—'}
                        label="Judge Score"
                        color={c.avgJudgeOverall != null ? (c.avgJudgeOverall >= 7 ? 'text-emerald-400' : c.avgJudgeOverall >= 5 ? 'text-amber-400' : 'text-red-400') : 'text-[#4A5168]'}
                      />
                      <MetricBadge
                        value={c.avgTrustConfidence != null ? `${(c.avgTrustConfidence * 100).toFixed(1)}%` : '—'}
                        label="Trust"
                        color="text-blue-400"
                      />
                      <MetricBadge
                        value={c.avgLatencyMs ? `${Math.round(c.avgLatencyMs)}ms` : '—'}
                        label="Avg Latency"
                        color="text-[#8892AA]"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-white/[0.06]">
                <p className="text-sm font-semibold text-[#F1F3F9]">Raw Data</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      {['Model Version', 'Runs', 'Cases', 'Avg Judge', 'Avg Trust', 'Avg Latency (ms)'].map(h => (
                        <th key={h} className="px-5 py-3 text-left font-semibold text-[#4A5168] uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {comparisons.map((c) => (
                      <tr key={c.modelVersion} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-3.5 font-mono text-[#F1F3F9]">{c.modelVersion}</td>
                        <td className="px-5 py-3.5 text-[#8892AA]">{c.runCount}</td>
                        <td className="px-5 py-3.5 text-[#8892AA]">{c.totalCases}</td>
                        <td className="px-5 py-3.5">
                          {c.avgJudgeOverall != null
                            ? <span className={c.avgJudgeOverall >= 7 ? 'text-emerald-400 font-semibold' : c.avgJudgeOverall >= 5 ? 'text-amber-400' : 'text-red-400'}>{c.avgJudgeOverall.toFixed(2)}</span>
                            : <span className="text-[#4A5168]">—</span>}
                        </td>
                        <td className="px-5 py-3.5 text-[#8892AA]">{c.avgTrustConfidence != null ? `${(c.avgTrustConfidence * 100).toFixed(1)}%` : '—'}</td>
                        <td className="px-5 py-3.5 text-[#8892AA]">{c.avgLatencyMs?.toFixed(0) ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
