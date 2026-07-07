'use client';

import { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { SectionHeader, EvalEmptyState, LoadingGrid, TOOLTIP_STYLE } from './_shared';
import { useQualityDashboard } from '@/hooks/useEvaluation';

export function TrendsTab() {
  const { data: dashboard, isLoading } = useQualityDashboard(30);

  const chartData = useMemo(() => {
    return (dashboard?.rollups ?? []).map(r => ({
      day: r.day.slice(5),
      judge: r.avgJudgeOverall ? +r.avgJudgeOverall.toFixed(2) : null,
      faithfulness: r.avgFaithfulness ? +r.avgFaithfulness.toFixed(2) : null,
      hallucination: r.avgHallucinationRisk ? +r.avgHallucinationRisk.toFixed(2) : null,
      abstention: r.totalAnswers > 0 ? +((r.abstentionCount / r.totalAnswers) * 100).toFixed(1) : 0,
      total: r.totalAnswers,
    }));
  }, [dashboard]);

  if (isLoading) return <div className="h-64 bg-white/[0.03] rounded-2xl animate-pulse" />;
  if (!chartData.length) return <EvalEmptyState icon={TrendingUp} title="No trend data yet" sub="Quality trends appear after the first daily rollup runs. Trigger one from the Overview tab." />;

  return (
    <div className="space-y-8">
      <SectionHeader title="30-Day Quality Trends" sub="Daily aggregated metrics from LLM-as-Judge evaluations" />

      <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-6">
        <p className="text-sm font-semibold text-[#F1F3F9] mb-4">Judge & Faithfulness Scores</p>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="day" tick={{ fill: '#4A5168', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 10]} tick={{ fill: '#4A5168', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ color: '#8892AA', fontSize: 12 }} />
            <Line type="monotone" dataKey="judge" stroke="#8B5CF6" strokeWidth={2} dot={false} name="Judge Overall" connectNulls />
            <Line type="monotone" dataKey="faithfulness" stroke="#10B981" strokeWidth={2} dot={false} name="Faithfulness" connectNulls />
            <Line type="monotone" dataKey="hallucination" stroke="#EF4444" strokeWidth={2} dot={false} name="Hallucination Risk" connectNulls strokeDasharray="4 2" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-6">
          <p className="text-sm font-semibold text-[#F1F3F9] mb-4">Daily Answer Volume</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="day" tick={{ fill: '#4A5168', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#4A5168', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Bar dataKey="total" fill="#6366F1" radius={[3, 3, 0, 0]} name="Answers" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-6">
          <p className="text-sm font-semibold text-[#F1F3F9] mb-4">Abstention Rate (%)</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="day" tick={{ fill: '#4A5168', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#4A5168', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Line type="monotone" dataKey="abstention" stroke="#F59E0B" strokeWidth={2} dot={false} name="Abstention %" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
