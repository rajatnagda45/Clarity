'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart2, Shield, BookOpen, TrendingUp, AlertTriangle,
  CheckCircle2, XCircle, Loader2, RefreshCw, Database,
  MessageSquare, Zap, Brain, Target, Activity,
  ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { PremiumBackground } from '@/components/landing/PremiumBackground';
import { useQualityDashboard, useEvalRuns, useCitationAnalytics, useTrustAnalytics, useConversationEvals, useTriggerQualityRollup } from '@/hooks/useEvaluation';
import { useBenchmarkRuns } from '@/hooks/useBenchmarks';
import { useModelComparisons } from '@/hooks/useRegressions';
import Link from 'next/link';

const TABS = [
  { id: 'overview', label: 'Overview', icon: BarChart2 },
  { id: 'trends', label: 'Quality Trends', icon: TrendingUp },
  { id: 'benchmarks', label: 'Benchmark Runs', icon: Target },
  { id: 'leaderboard', label: 'Model Leaderboard', icon: Brain },
  { id: 'citations', label: 'Citations', icon: BookOpen },
  { id: 'trust', label: 'Trust & Verdicts', icon: Shield },
  { id: 'conversations', label: 'Conversation Evals', icon: MessageSquare },
];

const CHART_COLORS = ['#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#EC4899'];

function KpiCard({
  label, value, sub, icon: Icon, color, delta,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color: string;
  delta?: number | null;
}) {
  return (
    <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-5 relative overflow-hidden group">
      <div className={`absolute top-0 right-0 w-20 h-20 ${color} opacity-10 blur-2xl rounded-full pointer-events-none`} />
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color.replace('bg-', 'bg-').replace('/20', '/20')}`}>
          <Icon size={16} className={color.replace('bg-', 'text-').replace('/20', '')} />
        </div>
        {delta != null && (
          <span className={`flex items-center gap-1 text-xs font-medium ${delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-[#4A5168]'}`}>
            {delta > 0 ? <ArrowUpRight size={12} /> : delta < 0 ? <ArrowDownRight size={12} /> : <Minus size={12} />}
            {Math.abs(delta).toFixed(1)}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-[#F1F3F9] mb-1">{value}</p>
      <p className="text-xs text-[#8892AA]">{label}</p>
      {sub && <p className="text-[11px] text-[#4A5168] mt-0.5">{sub}</p>}
    </div>
  );
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-bold text-[#F1F3F9]">{title}</h2>
      {sub && <p className="text-sm text-[#8892AA] mt-0.5">{sub}</p>}
    </div>
  );
}

function EmptyState({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-4">
        <Icon size={22} className="text-[#4A5168]" />
      </div>
      <p className="text-sm font-medium text-[#F1F3F9]">{title}</p>
      <p className="text-xs text-[#4A5168] mt-1 max-w-xs">{sub}</p>
    </div>
  );
}

function LoadingGrid({ cols = 4, rows = 1 }: { cols?: number; rows?: number }) {
  const colClass =
    cols === 1 ? 'grid-cols-1' :
    cols === 2 ? 'grid-cols-2' :
    cols === 3 ? 'grid-cols-3' :
    'grid-cols-4';
  return (
    <div className={`grid ${colClass} gap-4`}>
      {Array.from({ length: cols * rows }).map((_, i) => (
        <div key={i} className="h-28 bg-white/[0.03] border border-white/[0.04] rounded-2xl animate-pulse" />
      ))}
    </div>
  );
}

// ─── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab() {
  const { data: dashboard, isLoading: dLoading } = useQualityDashboard(30);
  const { data: evalRuns, isLoading: eLoading } = useEvalRuns(100);
  const { data: trust, isLoading: tLoading } = useTrustAnalytics();
  const { data: citations, isLoading: cLoading } = useCitationAnalytics();
  const { data: bRuns, isLoading: bLoading } = useBenchmarkRuns();
  const rollupMut = useTriggerQualityRollup();

  const latestRollup = dashboard?.rollups?.[dashboard.rollups.length - 1];
  const isLoading = dLoading || eLoading || tLoading || cLoading || bLoading;

  const avgJudge = useMemo(() => {
    const evals = evalRuns?.evaluations ?? [];
    const vals = evals.map(e => e.scores?.overall).filter((v): v is number => v != null);
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : null;
  }, [evalRuns]);

  const completedRuns = bRuns?.filter(r => r.status === 'completed').length ?? 0;

  if (isLoading) return <LoadingGrid cols={4} rows={2} />;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Avg Judge Score"
          value={avgJudge ? `${avgJudge}/10` : '—'}
          sub="LLM-as-Judge (8 dimensions)"
          icon={Brain}
          color="bg-purple-500"
        />
        <KpiCard
          label="Avg Trust Score"
          value={trust?.avgTrustOverall != null ? `${(trust.avgTrustOverall * 100).toFixed(1)}%` : '—'}
          sub="Faithfulness × Confidence"
          icon={Shield}
          color="bg-emerald-500"
        />
        <KpiCard
          label="Abstention Rate"
          value={trust?.abstentionRate != null ? `${(trust.abstentionRate * 100).toFixed(1)}%` : '—'}
          sub={`${trust?.abstentionCount ?? 0} abstentions total`}
          icon={AlertTriangle}
          color="bg-amber-500"
        />
        <KpiCard
          label="Citation Quality"
          value={citations?.avgCitationQualityScore != null ? `${citations.avgCitationQualityScore}/10` : '—'}
          sub={`${citations?.totalCitations ?? 0} total citations`}
          icon={BookOpen}
          color="bg-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total Eval Runs"
          value={String(evalRuns?.total ?? 0)}
          sub="LLM-as-Judge evaluations"
          icon={Activity}
          color="bg-pink-500"
        />
        <KpiCard
          label="Hallucination Risk"
          value={latestRollup?.avgHallucinationRisk != null ? `${latestRollup.avgHallucinationRisk.toFixed(1)}/10` : '—'}
          sub="Lower is better"
          icon={AlertTriangle}
          color="bg-red-500"
        />
        <KpiCard
          label="Completed Bench Runs"
          value={String(completedRuns)}
          sub="Benchmark suites executed"
          icon={Target}
          color="bg-cyan-500"
        />
        <KpiCard
          label="Supported Claims"
          value={trust?.verdictBreakdown ? `${trust.verdictBreakdown.supported}` : '—'}
          sub={`vs ${trust?.verdictBreakdown?.contradicted ?? 0} contradicted`}
          icon={CheckCircle2}
          color="bg-teal-500"
        />
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => rollupMut.mutate()}
          disabled={rollupMut.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-sm text-[#8892AA] hover:text-[#F1F3F9] hover:bg-white/[0.07] transition-colors"
        >
          {rollupMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Trigger Quality Rollup
        </button>
      </div>
    </div>
  );
}

// ─── Trends Tab ────────────────────────────────────────────────────────────────

function TrendsTab() {
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
  if (!chartData.length) return <EmptyState icon={TrendingUp} title="No trend data yet" sub="Quality trends appear after the first daily rollup runs. Trigger one from the Overview tab." />;

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
            <Tooltip contentStyle={{ background: '#0F1117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }} labelStyle={{ color: '#F1F3F9' }} />
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
              <Tooltip contentStyle={{ background: '#0F1117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }} />
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
              <Tooltip contentStyle={{ background: '#0F1117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }} />
              <Line type="monotone" dataKey="abstention" stroke="#F59E0B" strokeWidth={2} dot={false} name="Abstention %" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ─── Benchmarks Tab ────────────────────────────────────────────────────────────

function BenchmarksTab() {
  const { data: runs, isLoading } = useBenchmarkRuns();

  if (isLoading) return <LoadingGrid cols={1} rows={3} />;

  const statusColor: Record<string, string> = {
    completed: 'text-emerald-400 bg-emerald-400/10',
    running: 'text-blue-400 bg-blue-400/10',
    failed: 'text-red-400 bg-red-400/10',
    cancelled: 'text-[#4A5168] bg-white/[0.04]',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionHeader title="Benchmark Runs" sub="All benchmark executions across datasets" />
        <Link href="/eval/benchmarks" className="px-4 py-2 rounded-xl bg-purple-500 text-white text-sm font-semibold hover:bg-purple-600 transition-colors">
          Manage Datasets →
        </Link>
      </div>

      {!runs?.length ? (
        <EmptyState icon={Target} title="No benchmark runs yet" sub="Create a benchmark dataset and trigger your first run from the Benchmarks page." />
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
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${statusColor[run.status] ?? 'text-[#4A5168]'}`}>
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

// ─── Leaderboard Tab ───────────────────────────────────────────────────────────

function LeaderboardTab() {
  const { data: comps, isLoading } = useModelComparisons();

  if (isLoading) return <LoadingGrid cols={1} rows={4} />;
  if (!comps?.comparisons.length) return <EmptyState icon={Brain} title="No model comparison data" sub="Complete benchmark runs with different model versions to see leaderboard rankings." />;

  const chartData = comps.comparisons.map(c => ({
    name: c.modelVersion.length > 18 ? c.modelVersion.slice(0, 18) + '…' : c.modelVersion,
    fullName: c.modelVersion,
    judge: c.avgJudgeOverall ?? 0,
    trust: c.avgTrustConfidence != null ? +(c.avgTrustConfidence * 10).toFixed(1) : 0,
    latency: c.avgLatencyMs ? +(c.avgLatencyMs / 1000).toFixed(2) : 0,
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
            <Tooltip contentStyle={{ background: '#0F1117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }} />
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

// ─── Citations Tab ─────────────────────────────────────────────────────────────

function CitationsTab() {
  const { data: citations, isLoading } = useCitationAnalytics();

  if (isLoading) return <LoadingGrid cols={3} rows={2} />;
  if (!citations) return <EmptyState icon={BookOpen} title="No citation data" sub="Citations appear after AI answers with source references are generated." />;

  const pieData = [
    { name: 'With Citations', value: citations.answersWithCitations },
    { name: 'Without Citations', value: citations.answersWithoutCitations },
  ];

  return (
    <div className="space-y-8">
      <SectionHeader title="Citation Quality Analytics" sub="Coverage and quality of source citations across all AI answers" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Citations', value: String(citations.totalCitations), icon: BookOpen, color: 'bg-blue-500' },
          { label: 'Avg Citations/Answer', value: citations.avgCitationsPerAnswer.toFixed(1), icon: Database, color: 'bg-purple-500' },
          { label: 'Citation Quality Score', value: citations.avgCitationQualityScore != null ? `${citations.avgCitationQualityScore}/10` : '—', icon: Shield, color: 'bg-emerald-500' },
          { label: 'Answers with Citations', value: `${citations.totalCitations > 0 ? Math.round((citations.answersWithCitations / (citations.answersWithCitations + citations.answersWithoutCitations)) * 100) : 0}%`, icon: CheckCircle2, color: 'bg-teal-500' },
        ].map(k => <KpiCard key={k.label} {...k} />)}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-6">
          <p className="text-sm font-semibold text-[#F1F3F9] mb-4">Citation Coverage</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                {pieData.map((_, index) => (
                  <Cell key={index} fill={index === 0 ? '#8B5CF6' : '#1F2433'} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#0F1117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }} />
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
              <Tooltip contentStyle={{ background: '#0F1117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }} />
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

// ─── Trust Tab ─────────────────────────────────────────────────────────────────

function TrustTab() {
  const { data: trust, isLoading } = useTrustAnalytics();

  if (isLoading) return <LoadingGrid cols={3} rows={2} />;
  if (!trust) return <EmptyState icon={Shield} title="No trust data" sub="Trust analytics appear after AI answers with verification pipeline results are generated." />;

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
              <Tooltip contentStyle={{ background: '#0F1117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }} />
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
              <Tooltip contentStyle={{ background: '#0F1117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }} />
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
              <Tooltip contentStyle={{ background: '#0F1117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }} />
              <Bar dataKey="count" fill="#8B5CF6" radius={[3, 3, 0, 0]} name="Answers" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ─── Conversations Tab ─────────────────────────────────────────────────────────

function ConversationsTab() {
  const { data: convEvals, isLoading } = useConversationEvals(30);

  if (isLoading) return <LoadingGrid cols={1} rows={4} />;
  if (!convEvals?.conversations.length) return <EmptyState icon={MessageSquare} title="No conversation eval data" sub="Conversation-level metrics appear after AI chat sessions with LLM-as-Judge evaluations." />;

  return (
    <div className="space-y-6">
      <SectionHeader title="Conversation Evaluation" sub="Per-conversation AI quality aggregates" />
      <div className="space-y-3">
        {convEvals.conversations.map(conv => (
          <div key={conv.conversationId} className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-mono text-[#8892AA]">{conv.conversationId.slice(0, 16)}…</p>
                <p className="text-xs text-[#4A5168] mt-0.5">{new Date(conv.createdAt).toLocaleDateString()} · {conv.messageCount} message{conv.messageCount !== 1 ? 's' : ''}</p>
              </div>
              {conv.abstentionCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs text-amber-400 bg-amber-400/10">{conv.abstentionCount} abstention{conv.abstentionCount !== 1 ? 's' : ''}</span>
              )}
            </div>
            <div className="grid grid-cols-4 gap-4 text-xs">
              <div><p className="text-[#4A5168]">Judge</p><p className="text-[#F1F3F9] font-semibold">{conv.avgJudgeOverall?.toFixed(1) ?? '—'}/10</p></div>
              <div><p className="text-[#4A5168]">Trust</p><p className="text-[#F1F3F9] font-semibold">{conv.avgTrustOverall != null ? `${(conv.avgTrustOverall * 100).toFixed(0)}%` : '—'}</p></div>
              <div><p className="text-[#4A5168]">Hallucination Risk</p><p className="text-[#F1F3F9] font-semibold">{conv.avgHallucinationRisk?.toFixed(1) ?? '—'}/10</p></div>
              <div><p className="text-[#4A5168]">Citation Quality</p><p className="text-[#F1F3F9] font-semibold">{conv.avgCitationQuality?.toFixed(1) ?? '—'}/10</p></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Root Page ─────────────────────────────────────────────────────────────────

export default function EvalDashboard() {
  const [activeTab, setActiveTab] = useState('overview');

  const renderTab = () => {
    switch (activeTab) {
      case 'overview': return <OverviewTab />;
      case 'trends': return <TrendsTab />;
      case 'benchmarks': return <BenchmarksTab />;
      case 'leaderboard': return <LeaderboardTab />;
      case 'citations': return <CitationsTab />;
      case 'trust': return <TrustTab />;
      case 'conversations': return <ConversationsTab />;
      default: return <OverviewTab />;
    }
  };

  return (
    <div className="relative min-h-screen bg-[#05070B] selection:bg-purple-500/30 selection:text-white pb-32">
      <PremiumBackground glowOpacity={0.08} />

      <div className="relative z-10 mx-auto max-w-[1400px] px-6 pt-10 pb-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#F1F3F9] tracking-tight flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <BarChart2 size={20} className="text-purple-400" />
              </div>
              AI Quality Dashboard
            </h1>
            <p className="text-sm text-[#8892AA] mt-1.5">LLM evaluation · Trust verification · Benchmark management · Citation analytics</p>
          </div>
          <Link href="/eval/benchmarks" className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-500 text-white text-sm font-semibold hover:bg-purple-600 transition-colors">
            <Target size={16} />
            Benchmarks
          </Link>
        </div>

        {/* Tab Bar */}
        <div className="flex gap-1 bg-[#0F1117] border border-white/[0.06] rounded-2xl p-1 mb-8 overflow-x-auto">
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    : 'text-[#8892AA] hover:text-[#F1F3F9] hover:bg-white/[0.04]'
                }`}
              >
                <tab.icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {renderTab()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
