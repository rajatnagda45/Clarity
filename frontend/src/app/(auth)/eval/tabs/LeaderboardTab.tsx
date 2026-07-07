'use client';

import { Brain } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { SectionHeader, EvalEmptyState, LoadingGrid, TOOLTIP_STYLE } from './_shared';
import { useModelComparisons } from '@/hooks/useRegressions';

export function LeaderboardTab() {
  const { data: comps, isLoading } = useModelComparisons();

  if (isLoading) return <LoadingGrid cols={1} rows={4} />;
  if (!comps?.comparisons.length) return <EvalEmptyState icon={Brain} title="No model comparison data" sub="Complete benchmark runs with different model versions to see leaderboard rankings." />;

  const chartData = comps.comparisons.map(c => ({
    name: c.modelVersion.length > 18 ? c.modelVersion.slice(0, 18) + '…' : c.modelVersion,
    judge: c.avgJudgeOverall ?? 0,
    trust: c.avgTrustConfidence != null ? +(c.avgTrustConfidence * 10).toFixed(1) : 0,
  }));

  return (
    <div className="space-y-8">
      <SectionHeader title="Model Leaderboard" sub="Ranked by average judge score across all benchmark runs" />

      <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-6">
        <p className="text-sm font-semibold text-[#F1F3F9] mb-4">Judge Score vs Trust Score</p>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
            <XAxis type="number" domain={[0, 10]} tick={{ fill: '#4A5168', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={{ fill: '#8892AA', fontSize: 11 }} axisLine={false} tickLine={false} width={120} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ color: '#8892AA', fontSize: 12 }} />
            <Bar dataKey="judge" fill="#8B5CF6" radius={[0, 4, 4, 0]} name="Judge Score" />
            <Bar dataKey="trust" fill="#10B981" radius={[0, 4, 4, 0]} name="Trust (×10)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-3">
        {comps.comparisons.map((c, i) => (
          <div key={c.modelVersion} className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-5 flex items-center gap-5">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${i === 0 ? 'bg-amber-500/20 text-amber-400' : i === 1 ? 'bg-[#8892AA]/20 text-[#8892AA]' : 'bg-white/[0.04] text-[#4A5168]'}`}>
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#F1F3F9] truncate">{c.modelVersion}</p>
              <p className="text-xs text-[#4A5168]">{c.runCount} run{c.runCount !== 1 ? 's' : ''} · {c.totalCases} cases</p>
            </div>
            <div className="grid grid-cols-3 gap-6 text-right shrink-0">
              <div><p className="text-xs text-[#4A5168]">Judge</p><p className="text-sm font-bold text-purple-400">{c.avgJudgeOverall?.toFixed(1) ?? '—'}</p></div>
              <div><p className="text-xs text-[#4A5168]">Trust</p><p className="text-sm font-bold text-emerald-400">{c.avgTrustConfidence != null ? `${(c.avgTrustConfidence * 100).toFixed(0)}%` : '—'}</p></div>
              <div><p className="text-xs text-[#4A5168]">Latency</p><p className="text-sm font-bold text-[#F1F3F9]">{c.avgLatencyMs ? `${Math.round(c.avgLatencyMs)}ms` : '—'}</p></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
