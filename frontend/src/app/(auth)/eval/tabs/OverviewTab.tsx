'use client';

import { useMemo } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import {
  Brain, Shield, AlertTriangle, BookOpen,
  Activity, Target, CheckCircle2, MessageSquare,
} from 'lucide-react';
import { KpiCard, LoadingGrid } from './_shared';
import {
  useQualityDashboard, useEvalRuns, useCitationAnalytics,
  useTrustAnalytics, useTriggerQualityRollup,
} from '@/hooks/useEvaluation';
import { useBenchmarkRuns } from '@/hooks/useBenchmarks';

export function OverviewTab() {
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
