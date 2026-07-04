'use client';

import { useMemo } from 'react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts';
import { Brain, Zap, Shield, BookOpen, AlertTriangle, Trophy } from 'lucide-react';
import { PremiumBackground } from '@/components/landing/PremiumBackground';
import { useModelComparisons } from '@/hooks/useRegressions';

const MODEL_COLORS = ['#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#EC4899'];

function MetricBadge({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div className="text-center">
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-[#4A5168] mt-0.5">{label}</p>
    </div>
  );
}

export default function ModelComparisonsPage() {
  const { data, isLoading, isError } = useModelComparisons();
  const comparisons = data?.comparisons ?? [];

  const radarData = useMemo(() => {
    if (!comparisons.length) return [];
    return [
      { metric: 'Judge Score', ...Object.fromEntries(comparisons.map(c => [c.modelVersion, (c.avgJudgeOverall ?? 0)])) },
      { metric: 'Trust (×10)', ...Object.fromEntries(comparisons.map(c => [c.modelVersion, (c.avgTrustConfidence ?? 0) * 10])) },
    ];
  }, [comparisons]);

  const barData = useMemo(() => comparisons.map((c, i) => ({
    name: c.modelVersion.length > 20 ? c.modelVersion.slice(0, 20) + '…' : c.modelVersion,
    fullName: c.modelVersion,
    judge: +(c.avgJudgeOverall ?? 0).toFixed(2),
    trust: +((c.avgTrustConfidence ?? 0) * 10).toFixed(2),
    latency: c.avgLatencyMs ? +(c.avgLatencyMs / 100).toFixed(2) : 0,
    color: MODEL_COLORS[i % MODEL_COLORS.length],
  })), [comparisons]);

  return (
    <div className="relative min-h-screen bg-[#05070B] selection:bg-purple-500/30 selection:text-white pb-32">
      <PremiumBackground glowOpacity={0.07} />

      <div className="relative z-10 mx-auto max-w-[1400px] px-6 pt-10 pb-8">
        {/* Header */}
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
            <div className="h-72 bg-white/[0.03] border border-white/[0.04] rounded-2xl animate-pulse" />
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
            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Radar Chart */}
              <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-6">
                <p className="text-sm font-semibold text-[#F1F3F9] mb-6">Multi-Metric Radar</p>
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                    <PolarGrid stroke="rgba(255,255,255,0.06)" />
                    <PolarAngleAxis dataKey="metric" tick={{ fill: '#8892AA', fontSize: 12 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fill: '#4A5168', fontSize: 10 }} />
                    {comparisons.slice(0, 4).map((c, i) => (
                      <Radar
                        key={c.modelVersion}
                        name={c.modelVersion}
                        dataKey={c.modelVersion}
                        stroke={MODEL_COLORS[i % MODEL_COLORS.length]}
                        fill={MODEL_COLORS[i % MODEL_COLORS.length]}
                        fillOpacity={0.12}
                        strokeWidth={2}
                      />
                    ))}
                    <Legend wrapperStyle={{ color: '#8892AA', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: '#0F1117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Bar Chart: Judge vs Trust vs Latency */}
              <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-6">
                <p className="text-sm font-semibold text-[#F1F3F9] mb-1">Judge · Trust · Latency</p>
                <p className="text-xs text-[#4A5168] mb-4">Judge & Trust out of 10 · Latency ÷ 100</p>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={barData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                    <XAxis type="number" domain={[0, 10]} tick={{ fill: '#4A5168', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#8892AA', fontSize: 10 }} axisLine={false} tickLine={false} width={110} />
                    <Tooltip contentStyle={{ background: '#0F1117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }} />
                    <Legend wrapperStyle={{ color: '#8892AA', fontSize: 11 }} />
                    <Bar dataKey="judge" fill="#8B5CF6" radius={[0, 3, 3, 0]} name="Judge Score" />
                    <Bar dataKey="trust" fill="#10B981" radius={[0, 3, 3, 0]} name="Trust (×10)" />
                    <Bar dataKey="latency" fill="#F59E0B" radius={[0, 3, 3, 0]} name="Latency (÷100)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Leaderboard cards */}
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

            {/* Raw data table */}
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
                    {comparisons.map((c, i) => (
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
