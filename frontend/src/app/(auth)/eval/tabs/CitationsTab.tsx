'use client';

import { BookOpen, Database, Shield, CheckCircle2 } from 'lucide-react';
import {
  PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { KpiCard, SectionHeader, EvalEmptyState, LoadingGrid, TOOLTIP_STYLE } from './_shared';
import { useCitationAnalytics } from '@/hooks/useEvaluation';

export function CitationsTab() {
  const { data: citations, isLoading } = useCitationAnalytics();

  if (isLoading) return <LoadingGrid cols={3} rows={2} />;
  if (!citations) return <EvalEmptyState icon={BookOpen} title="No citation data" sub="Citations appear after AI answers with source references are generated." />;

  const pieData = [
    { name: 'With Citations', value: citations.answersWithCitations },
    { name: 'Without Citations', value: citations.answersWithoutCitations },
  ];

  const coveragePct = citations.totalCitations > 0
    ? Math.round((citations.answersWithCitations / (citations.answersWithCitations + citations.answersWithoutCitations)) * 100)
    : 0;

  return (
    <div className="space-y-8">
      <SectionHeader title="Citation Quality Analytics" sub="Coverage and quality of source citations across all AI answers" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Citations" value={String(citations.totalCitations)} icon={BookOpen} color="bg-blue-500" />
        <KpiCard label="Avg Citations/Answer" value={citations.avgCitationsPerAnswer.toFixed(1)} icon={Database} color="bg-purple-500" />
        <KpiCard label="Citation Quality Score" value={citations.avgCitationQualityScore != null ? `${citations.avgCitationQualityScore}/10` : '—'} icon={Shield} color="bg-emerald-500" />
        <KpiCard label="Answers with Citations" value={`${coveragePct}%`} icon={CheckCircle2} color="bg-teal-500" />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-6">
          <p className="text-sm font-semibold text-[#F1F3F9] mb-4">Citation Coverage</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                <Cell fill="#8B5CF6" />
                <Cell fill="#1F2433" />
              </Pie>
              <Tooltip {...TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ color: '#8892AA', fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-6">
          <p className="text-sm font-semibold text-[#F1F3F9] mb-4">Quality Score Distribution</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={citations.citationQualityDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="range" tick={{ fill: '#4A5168', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#4A5168', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Bar dataKey="count" fill="#8B5CF6" radius={[4, 4, 0, 0]} name="Answers" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {citations.topCitedDocuments.length > 0 && (
        <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-6">
          <p className="text-sm font-semibold text-[#F1F3F9] mb-4">Most Referenced Documents</p>
          <div className="space-y-3">
            {citations.topCitedDocuments.slice(0, 8).map((doc, i) => {
              const max = citations.topCitedDocuments[0]?.citationCount ?? 1;
              const pct = (doc.citationCount / max) * 100;
              return (
                <div key={doc.documentId} className="flex items-center gap-4">
                  <span className="text-xs text-[#4A5168] w-4 shrink-0">{i + 1}</span>
                  <p className="text-xs font-mono text-[#8892AA] w-28 shrink-0 truncate">{doc.documentId.slice(0, 12)}…</p>
                  <div className="flex-1 h-2 bg-white/[0.04] rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500/70 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-[#F1F3F9] w-8 text-right shrink-0">{doc.citationCount}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
