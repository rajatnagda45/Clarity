'use client';

import { Activity, Cpu, FileText, MessageSquare, DollarSign, Zap, Database } from 'lucide-react';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { useDocuments } from '@/hooks/useDocuments';

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function MetricBlock({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-[#05070B] border border-white/[0.04] rounded-xl p-5 relative overflow-hidden group">
      <div className={`absolute top-0 right-0 w-24 h-24 ${color} opacity-5 blur-[30px] rounded-full pointer-events-none group-hover:opacity-10 transition-opacity`} />
      <div className="flex items-center gap-2 text-[#8892AA] mb-3">
        <Icon size={16} className={color.replace('bg-', 'text-').replace('/20', '')} />
        <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-bold text-[#F1F3F9]">{value}</p>
      {sub && <p className="text-xs text-[#4A5168] mt-1">{sub}</p>}
    </div>
  );
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

const PLAN_LIMITS = {
  free: { docs: 10, tokens: 50_000, storage: 100 * 1024 * 1024, queries: 100 },
  pro: { docs: 500, tokens: 5_000_000, storage: 10 * 1024 * 1024 * 1024, queries: 10_000 },
  team: { docs: 5000, tokens: 50_000_000, storage: 100 * 1024 * 1024 * 1024, queries: 100_000 },
};

export function UsageTab() {
  const { devDashboard, answerMetrics } = useDashboardMetrics();
  const { data: documents } = useDocuments();

  const totalDocs = documents?.length ?? 0;
  const indexedDocs = devDashboard.data?.statusCounts?.indexed ?? 0;
  const storageBytes = devDashboard.data?.totalStorageBytes ?? null;
  const totalTokens = answerMetrics.data?.totalTokens ?? null;
  const totalConversations = answerMetrics.data?.conversationsCreated ?? null;
  const estimatedCost = answerMetrics.data?.estimatedCostUsd ?? null;
  const avgLatency = answerMetrics.data?.answerLatencyMs ?? null;
  const promptTokens = answerMetrics.data?.promptTokens ?? null;
  const completionTokens = answerMetrics.data?.completionTokens ?? null;

  const plan = devDashboard.data ? 'free' : 'free';
  const limits = PLAN_LIMITS[plan];

  const isLoading = devDashboard.isLoading || answerMetrics.isLoading;

  return (
    <div className="flex flex-col animate-in fade-in duration-500 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#F1F3F9] tracking-tight flex items-center gap-2">
          <Activity size={22} className="text-purple-400" />
          Workspace Usage
        </h1>
        <p className="text-sm text-[#8892AA] mt-1">Real-time resource consumption for your workspace.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-[#05070B] border border-white/[0.04] rounded-xl p-5 h-28 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Core Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <MetricBlock
              icon={FileText}
              label="Documents"
              value={totalDocs.toString()}
              sub={`${indexedDocs} indexed`}
              color="bg-blue-500"
            />
            <MetricBlock
              icon={Cpu}
              label="Total Tokens"
              value={totalTokens != null ? totalTokens.toLocaleString() : 'Unavailable'}
              sub={totalTokens != null ? `${promptTokens?.toLocaleString() ?? 0} prompt · ${completionTokens?.toLocaleString() ?? 0} completion` : 'No AI usage yet'}
              color="bg-purple-500"
            />
            <MetricBlock
              icon={MessageSquare}
              label="Conversations"
              value={totalConversations != null ? totalConversations.toString() : 'Unavailable'}
              sub="Total AI sessions"
              color="bg-emerald-500"
            />
            <MetricBlock
              icon={Database}
              label="Storage Used"
              value={storageBytes != null ? formatBytes(storageBytes) : 'Unavailable'}
              sub={storageBytes != null ? `${((storageBytes / limits.storage) * 100).toFixed(1)}% of plan limit` : 'Storage tracking pending'}
              color="bg-orange-500"
            />
            <MetricBlock
              icon={DollarSign}
              label="Est. AI Cost"
              value={estimatedCost != null ? `$${estimatedCost.toFixed(4)}` : 'Unavailable'}
              sub="OpenAI API spend"
              color="bg-amber-500"
            />
            <MetricBlock
              icon={Zap}
              label="Avg Latency"
              value={avgLatency != null ? `${Math.round(avgLatency)}ms` : 'Unavailable'}
              sub="Per AI answer"
              color="bg-pink-500"
            />
          </div>

          {/* Quota Meters */}
          <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-6 space-y-5">
            <h2 className="text-sm font-bold text-[#F1F3F9]">Plan Quotas</h2>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[#8892AA] font-medium">Documents</span>
                <span className="text-[#F1F3F9]">{totalDocs} / {limits.docs.toLocaleString()}</span>
              </div>
              <ProgressBar value={totalDocs} max={limits.docs} color="bg-blue-500" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[#8892AA] font-medium">Tokens</span>
                <span className="text-[#F1F3F9]">
                  {totalTokens != null ? `${totalTokens.toLocaleString()} / ${limits.tokens.toLocaleString()}` : 'Unavailable'}
                </span>
              </div>
              <ProgressBar value={totalTokens ?? 0} max={limits.tokens} color="bg-purple-500" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[#8892AA] font-medium">Storage</span>
                <span className="text-[#F1F3F9]">
                  {storageBytes != null ? `${formatBytes(storageBytes)} / ${formatBytes(limits.storage)}` : 'Unavailable'}
                </span>
              </div>
              <ProgressBar value={storageBytes ?? 0} max={limits.storage} color="bg-orange-500" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[#8892AA] font-medium">AI Queries</span>
                <span className="text-[#F1F3F9]">
                  {totalConversations != null ? `${totalConversations.toLocaleString()} / ${limits.queries.toLocaleString()}` : 'Unavailable'}
                </span>
              </div>
              <ProgressBar value={totalConversations ?? 0} max={limits.queries} color="bg-emerald-500" />
            </div>

            <div className="pt-2 flex items-center gap-2 text-xs text-[#4A5168]">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Free plan · Resets monthly · <span className="text-purple-400 cursor-pointer hover:underline">Upgrade to Pro</span> for higher limits</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
