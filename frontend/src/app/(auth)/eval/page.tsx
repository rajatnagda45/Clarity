'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import { 
  BarChart2, Download, RefreshCw, Calendar, FileText, MessageSquare, 
  Zap, ShieldCheck, Database, Layers, ArrowUpRight, Activity, Users, AlertCircle 
} from 'lucide-react';

import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useDocuments } from '@/hooks/useDocuments';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { getEvalMetrics } from '@/lib/api';
import type { EvalMetrics } from '@/types/clarity';
import { PremiumBackground } from '@/components/landing/PremiumBackground';
import { ProgressBar } from '@/components/ds/Progress';

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function MetricCard({ title, value, icon: Icon, trend, subtitle }: { title: string, value: string | number, icon: any, trend?: string, subtitle?: string }) {
  return (
    <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-5 hover:border-purple-500/20 transition-colors group relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 blur-[50px] rounded-full pointer-events-none group-hover:bg-purple-500/10 transition-colors" />
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className="flex items-center gap-2 text-[#8892AA]">
          <Icon size={16} className="group-hover:text-purple-400 transition-colors" />
          <h3 className="text-xs font-semibold uppercase tracking-wider">{title}</h3>
        </div>
        {trend && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded">
            <ArrowUpRight size={10} strokeWidth={3} /> {trend}
          </span>
        )}
      </div>
      <div className="relative z-10">
        <p className="text-3xl font-bold text-[#F1F3F9] tracking-tight">{value}</p>
        {subtitle && <p className="text-xs text-[#4A5168] mt-1 font-medium">{subtitle}</p>}
      </div>
    </div>
  );
}

function EvalScoreWidget({ title, value }: { title: string, value: number | null | undefined }) {
  if (value == null) return null;
  const pct = Math.round(value * 100);
  return (
    <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-4 flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <span className="text-xs font-medium text-[#8892AA]">{title}</span>
        <span className={`text-sm font-bold ${pct >= 80 ? 'text-emerald-400' : pct >= 55 ? 'text-amber-400' : 'text-red-400'}`}>
          {pct}%
        </span>
      </div>
      <ProgressBar value={pct} size="sm" variant={pct >= 80 ? 'success' : pct >= 55 ? 'warning' : 'error'} />
    </div>
  );
}

export default function AnalyticsPage() {
  const { getToken } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const { data: documents } = useDocuments();
  const { devDashboard, answerMetrics } = useDashboardMetrics();
  
  const [golden, setGolden] = useState<EvalMetrics[]>([]);
  const [adversarial, setAdversarial] = useState<EvalMetrics[]>([]);
  const [loadingEvals, setLoadingEvals] = useState(false);

  useEffect(() => {
    if (!activeWorkspace) return;
    setLoadingEvals(true);
    let cancelled = false;
    getToken().then(async (token) => {
      if (!token || cancelled) return;
      const auth = { token, workspaceId: activeWorkspace.id };
      try {
        const [g, a] = await Promise.allSettled([
          getEvalMetrics(auth, 'golden'),
          getEvalMetrics(auth, 'adversarial'),
        ]);
        if (cancelled) return;
        if (g.status === 'fulfilled') setGolden(g.value);
        if (a.status === 'fulfilled') setAdversarial(a.value);
      } finally {
        if (!cancelled) setLoadingEvals(false);
      }
    });
    return () => { cancelled = true; };
  }, [activeWorkspace, getToken]);

  const latestGolden = golden[0];

  const totalDocs = documents?.length ?? 0;
  const indexedDocs = devDashboard.data?.statusCounts?.indexed ?? 0;
  const storageUsed = devDashboard.data?.totalStorageBytes ?? 0;
  
  const queries = answerMetrics.data?.conversationsCreated ?? 0;
  const avgLatency = answerMetrics.data?.firstTokenLatencyMs ? `${Math.round(answerMetrics.data.firstTokenLatencyMs)}ms` : '--';
  const tokens = answerMetrics.data?.totalTokens ? answerMetrics.data.totalTokens.toLocaleString() : '0';
  const citations = answerMetrics.data?.averageCitationsPerAnswer ? answerMetrics.data.averageCitationsPerAnswer.toFixed(1) : '--';
  const cost = answerMetrics.data?.estimatedCostUsd ? `$${answerMetrics.data.estimatedCostUsd.toFixed(4)}` : '$0.00';

  return (
    <div className="relative min-h-screen bg-[#05070B] selection:bg-purple-500/30 selection:text-white pb-20">
      <PremiumBackground glowOpacity={0.15} />

      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-8 px-6 py-8 relative z-10">
        
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.04] pb-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <BarChart2 size={20} className="text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#F1F3F9] tracking-tight">Observability</h1>
              <p className="text-xs text-[#8892AA] mt-0.5">Workspace health and AI performance metrics</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/[0.08] bg-[#0F1117] text-[#8892AA] hover:text-[#F1F3F9] hover:bg-white/[0.04] transition-all text-xs font-medium">
              <Calendar size={14} /> Last 30 Days
            </button>
            <button className="p-2 rounded-xl border border-white/[0.08] bg-[#0F1117] text-[#8892AA] hover:text-[#F1F3F9] hover:bg-white/[0.04] transition-all" title="Refresh">
              <RefreshCw size={16} />
            </button>
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black font-medium text-sm hover:bg-gray-200 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.1)] ml-2">
              <Download size={16} /> Export Report
            </button>
          </div>
        </div>

        {/* Executive Summary */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard title="Indexed Documents" value={`${indexedDocs} / ${totalDocs}`} icon={FileText} subtitle="Successfully vectorized" />
          <MetricCard title="AI Queries" value={queries} icon={MessageSquare} subtitle="Workspace conversations" />
          <MetricCard title="First Token Latency" value={avgLatency} icon={Zap} subtitle="Average response time" />
          <MetricCard title="Citation Density" value={citations} icon={Layers} subtitle="Sources per response" />
          <MetricCard title="Total Tokens" value={tokens} icon={Activity} subtitle="Inference consumption" />
          <MetricCard title="Storage Used" value={storageUsed > 0 ? formatBytes(storageUsed) : 'Unavailable'} icon={Database} subtitle="Vector database allocation" />
          <MetricCard title="Estimated Cost" value={cost} icon={BarChart2} subtitle="API inference cost" />
          <MetricCard title="System Status" value={answerMetrics.isError ? 'Degraded' : 'Operational'} icon={ShieldCheck} subtitle="Answer pipeline" />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-2">
          
          {/* Main Chart Area (Empty State) */}
          <div className="lg:col-span-2 bg-[#0F1117] border border-white/[0.06] rounded-2xl p-6 relative overflow-hidden min-h-[400px] flex flex-col">
            <h2 className="text-sm font-semibold text-[#F1F3F9] mb-6 flex items-center gap-2">
              <Activity size={16} className="text-purple-400" /> Usage Overview
            </h2>
            
            <div className="flex-1 flex flex-col items-center justify-center text-center relative z-10">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-center mb-4">
                <BarChart2 size={24} className="text-[#4A5168]" />
              </div>
              <h3 className="text-lg font-bold text-[#F1F3F9] mb-2">Insufficient Time-Series Data</h3>
              <p className="text-sm text-[#8892AA] max-w-sm mx-auto">
                Interactive charts require historical data points. Your workspace is currently accumulating insights. Check back soon for detailed visual trends.
              </p>
            </div>

            {/* Subtle background grid representing the "chart area" */}
            <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:linear-gradient(to_top,white,transparent)] pointer-events-none" />
          </div>

          {/* AI Performance / Quality Gates (Golden Evals) */}
          <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-6 flex flex-col h-full">
            <h2 className="text-sm font-semibold text-[#F1F3F9] mb-1 flex items-center gap-2">
              <ShieldCheck size={16} className="text-purple-400" /> Quality Gates
            </h2>
            <p className="text-xs text-[#8892AA] mb-6">Latest golden suite evaluation</p>
            
            {loadingEvals ? (
              <div className="space-y-4 animate-pulse">
                {[1,2,3,4].map(i => <div key={i} className="h-16 bg-white/[0.02] rounded-xl" />)}
              </div>
            ) : latestGolden ? (
              <div className="flex-1 flex flex-col gap-3">
                <EvalScoreWidget title="Faithfulness" value={latestGolden.faithfulness} />
                <EvalScoreWidget title="Relevance" value={latestGolden.relevance} />
                <EvalScoreWidget title="Context Precision" value={latestGolden.contextPrecision} />
                <EvalScoreWidget title="Context Recall" value={latestGolden.contextRecall} />
                {latestGolden.catchRate != null && <EvalScoreWidget title="Catch Rate" value={latestGolden.catchRate} />}
                
                <div className="mt-auto pt-4 flex items-center justify-between border-t border-white/[0.04] text-[10px] text-[#4A5168] font-mono">
                  <span>{new Date(latestGolden.createdAt).toLocaleDateString()}</span>
                  {latestGolden.commitSha && <span>{latestGolden.commitSha.slice(0,7)}</span>}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <AlertCircle size={24} className="text-[#4A5168] mb-3" />
                <p className="text-sm font-medium text-[#8892AA]">No eval runs recorded</p>
              </div>
            )}
          </div>
        </div>

        {/* Secondary Insights Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
          
          {/* Document Insights (Empty State) */}
          <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-6 min-h-[300px] flex flex-col">
            <h2 className="text-sm font-semibold text-[#F1F3F9] mb-6 flex items-center gap-2">
              <Layers size={16} className="text-purple-400" /> Document Insights
            </h2>
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-center mb-4">
                <FileText size={20} className="text-[#4A5168]" />
              </div>
              <h3 className="text-base font-bold text-[#F1F3F9] mb-2">Most Queried Documents</h3>
              <p className="text-xs text-[#8892AA] max-w-[250px]">
                Ask more questions to generate document-level retrieval heatmaps.
              </p>
            </div>
          </div>

          {/* Team Activity (Empty State) */}
          <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-6 min-h-[300px] flex flex-col">
            <h2 className="text-sm font-semibold text-[#F1F3F9] mb-6 flex items-center gap-2">
              <Users size={16} className="text-purple-400" /> Team Activity
            </h2>
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-center mb-4">
                <Activity size={20} className="text-[#4A5168]" />
              </div>
              <h3 className="text-base font-bold text-[#F1F3F9] mb-2">Workspace Events</h3>
              <p className="text-xs text-[#8892AA] max-w-[250px]">
                Collaborate with team members to populate the activity feed.
              </p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
