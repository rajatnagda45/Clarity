'use client';

import { Shield, CheckCircle2, AlertTriangle, MessageSquare } from 'lucide-react';
import {
  PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { KpiCard, SectionHeader, EvalEmptyState, LoadingGrid, TOOLTIP_STYLE } from './_shared';
import { useTrustAnalytics } from '@/hooks/useEvaluation';

export function TrustTab() {
  const { data: trust, isLoading } = useTrustAnalytics();

  if (isLoading) return <LoadingGrid cols={3} rows={2} />;
  if (!trust) return <EvalEmptyState icon={Shield} title="No trust data" sub="Trust analytics appear after AI answers with verification pipeline results are generated." />;

  const verdictData = [
    { name: 'Supported', value: trust.verdictBreakdown.supported, color: '#10B981' },
    { name: 'Unsupported', value: trust.verdictBreakdown.unsupported, color: '#F59E0B' },
    { name: 'Contradicted', value: trust.verdictBreakdown.contradicted, color: '#EF4444' },
    { name: 'Unknown', value: trust.verdictBreakdown.unknown, color: '#4A5168' },
  ];

  const bandData = [
    { name: 'High', value: trust.confidenceBandBreakdown.high, fill: '#10B981' },
    { name: 'Medium', value: trust.confidenceBandBreakdown.medium, fill: '#F59E0B' },
    { name: 'Low', value: trust.confidenceBandBreakdown.low, fill: '#EF4444' },
  ];

  return (
    <div className="space-y-8">
      <SectionHeader title="Trust & Verdict Analytics" sub="Two-signal verification outcomes across all AI answers" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Avg Trust Score" value={trust.avgTrustOverall != null ? `${(trust.avgTrustOverall * 100).toFixed(1)}%` : '—'} icon={Shield} color="bg-emerald-500" />
        <KpiCard label="Avg Faithfulness" value={trust.avgTrustFaithfulness != null ? `${(trust.avgTrustFaithfulness * 100).toFixed(1)}%` : '—'} icon={CheckCircle2} color="bg-blue-500" />
        <KpiCard label="Abstention Rate" value={`${(trust.abstentionRate * 100).toFixed(1)}%`} sub={`${trust.abstentionCount} answers abstained`} icon={AlertTriangle} color="bg-amber-500" />
        <KpiCard label="Total Answers" value={String(trust.totalAnswers)} icon={MessageSquare} color="bg-purple-500" />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-6">
          <p className="text-sm font-semibold text-[#F1F3F9] mb-4">Claim Verdict Distribution</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={verdictData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                {verdictData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip {...TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ color: '#8892AA', fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-6">
          <p className="text-sm font-semibold text-[#F1F3F9] mb-4">Confidence Band Distribution</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={bandData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="name" tick={{ fill: '#4A5168', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#4A5168', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} name="Answers">
                {bandData.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {trust.trustHistogram.length > 0 && (
        <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-6">
          <p className="text-sm font-semibold text-[#F1F3F9] mb-4">Trust Score Histogram</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={trust.trustHistogram}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="bucket" tick={{ fill: '#4A5168', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#4A5168', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Bar dataKey="count" fill="#8B5CF6" radius={[3, 3, 0, 0]} name="Answers" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
