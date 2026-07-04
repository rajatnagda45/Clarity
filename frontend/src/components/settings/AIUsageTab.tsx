'use client';

import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import {
  Cpu, FileText, MessageSquare, Database, Sparkles,
  Clock, FolderHeart, Zap, AlertCircle
} from 'lucide-react';

function MetricRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="p-5 rounded-2xl bg-[#0F1117] border border-white/[0.08] flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Icon size={16} className="text-[#8892AA]" />
        <h3 className="text-sm font-medium text-white">{label}</h3>
      </div>
      <span className="text-sm font-bold text-white">{value}</span>
    </div>
  );
}

export function AIUsageTab() {
  const { activeWorkspace } = useWorkspace();
  const { devDashboard, answerMetrics } = useDashboardMetrics();

  const isLoading = devDashboard.isLoading || answerMetrics.isLoading;
  const isError = devDashboard.isError && answerMetrics.isError;

  const totalDocuments = devDashboard.data?.documents.length ?? 0;
  const totalConversations = answerMetrics.data?.conversationsCreated ?? 0;
  const totalTokens = answerMetrics.data?.totalTokens;
  const promptTokens = answerMetrics.data?.promptTokens;
  const completionTokens = answerMetrics.data?.completionTokens;
  const avgLatencyMs = answerMetrics.data?.answerLatencyMs;
  const estimatedCost = answerMetrics.data?.estimatedCostUsd;
  const avgCitations = answerMetrics.data?.averageCitationsPerAnswer;

  return (
    <div className="flex flex-col animate-in fade-in duration-500 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight">AI Usage</h1>
        <p className="text-sm text-[#8892AA] mt-1">Real-time metrics from your workspace&apos;s AI activity.</p>
      </div>

      {isError && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 mb-6">
          <AlertCircle size={16} className="text-red-400 shrink-0" />
          <p className="text-sm text-red-400">Could not load usage data. Check your connection and try again.</p>
        </div>
      )}

      {/* Core Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="p-5 rounded-2xl bg-[#0F1117] border border-white/[0.08] relative overflow-hidden group hover:border-white/[0.15] transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <FileText size={18} />
            </div>
          </div>
          <h3 className="font-medium text-[#8892AA] text-sm mb-1">Documents Indexed</h3>
          <p className="text-2xl font-bold text-white">
            {isLoading ? <span className="animate-pulse">—</span> : totalDocuments}
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-[#0F1117] border border-white/[0.08] relative overflow-hidden group hover:border-white/[0.15] transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <Sparkles size={18} />
            </div>
          </div>
          <h3 className="font-medium text-[#8892AA] text-sm mb-1">AI Conversations</h3>
          <p className="text-2xl font-bold text-white">
            {isLoading ? <span className="animate-pulse">—</span> : totalConversations}
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-[#0F1117] border border-white/[0.08] relative overflow-hidden group hover:border-white/[0.15] transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <Zap size={18} />
            </div>
          </div>
          <h3 className="font-medium text-[#8892AA] text-sm mb-1">Tokens Processed</h3>
          <p className="text-2xl font-bold text-white">
            {isLoading ? (
              <span className="animate-pulse">—</span>
            ) : totalTokens != null ? (
              totalTokens.toLocaleString()
            ) : (
              <span className="text-base font-normal text-[#4A5168]">Unavailable</span>
            )}
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-[#0F1117] border border-white/[0.08] relative overflow-hidden group hover:border-white/[0.15] transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Database size={18} />
            </div>
          </div>
          <h3 className="font-medium text-[#8892AA] text-sm mb-1">Estimated Cost</h3>
          <p className="text-2xl font-bold text-white">
            {isLoading ? (
              <span className="animate-pulse">—</span>
            ) : estimatedCost != null ? (
              `$${estimatedCost.toFixed(4)}`
            ) : (
              <span className="text-base font-normal text-[#4A5168]">Unavailable</span>
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

        {/* Left Column: Secondary Metrics */}
        <div className="md:col-span-1 space-y-4">
          <MetricRow
            icon={Clock}
            label="Avg. Response"
            value={avgLatencyMs != null ? `${Math.round(avgLatencyMs)}ms` : 'Unavailable'}
          />
          <MetricRow
            icon={MessageSquare}
            label="Prompt Tokens"
            value={promptTokens != null ? promptTokens.toLocaleString() : 'Unavailable'}
          />
          <MetricRow
            icon={Cpu}
            label="Completion Tokens"
            value={completionTokens != null ? completionTokens.toLocaleString() : 'Unavailable'}
          />
          <MetricRow
            icon={FolderHeart}
            label="Avg. Citations / Answer"
            value={avgCitations != null ? avgCitations.toFixed(1) : 'Unavailable'}
          />
          <MetricRow
            icon={FolderHeart}
            label="Active Workspace"
            value={activeWorkspace?.name || 'None'}
          />
        </div>

        {/* Right Column: Token Breakdown */}
        <div className="md:col-span-2 rounded-2xl bg-[#0F1117] border border-white/[0.08] p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
              <Cpu size={16} className="text-purple-400" />
              Token Breakdown
            </h2>
          </div>

          {isLoading ? (
            <div className="flex-1 flex flex-col gap-4 animate-pulse">
              {[1, 2, 3].map(i => <div key={i} className="h-10 rounded-xl bg-white/[0.03]" />)}
            </div>
          ) : promptTokens == null && completionTokens == null ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-center mb-4">
                <Cpu size={20} className="text-[#4A5168]" />
              </div>
              <h3 className="text-base font-bold text-[#F1F3F9] mb-2">No usage data yet</h3>
              <p className="text-sm text-[#8892AA] max-w-xs">
                Start asking questions in AI Chat to see token usage and cost metrics here.
              </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-4">
              {[
                { label: 'Prompt Tokens', value: promptTokens ?? 0, total: totalTokens ?? 1, color: 'bg-blue-500' },
                { label: 'Completion Tokens', value: completionTokens ?? 0, total: totalTokens ?? 1, color: 'bg-purple-500' },
              ].map(({ label, value, total, color }) => {
                const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                return (
                  <div key={label}>
                    <div className="flex justify-between text-xs text-[#8892AA] mb-2">
                      <span>{label}</span>
                      <span>{value.toLocaleString()} ({pct}%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden">
                      <div className={`h-full rounded-full ${color}/60`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
