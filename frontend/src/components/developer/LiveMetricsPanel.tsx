'use client';

import { Activity, AlertCircle, RefreshCcw, Zap } from 'lucide-react';
import { useMetrics } from '@/hooks/useMetrics';
import type { EndpointMetric } from '@/types/clarity';

function fmt(n: number, decimals = 1) {
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-[#8892AA]">{label}</span>
      <span className="text-xl font-semibold text-[#F1F3F9] tabular-nums">{value}</span>
      {sub && <span className="text-xs text-[#8892AA]">{sub}</span>}
    </div>
  );
}

function EndpointRow({ path, metric }: { path: string; metric: EndpointMetric }) {
  const avg = metric.count ? metric.total_ms / metric.count : 0;
  const errRate = metric.count ? (metric.errors / metric.count) * 100 : 0;
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0 text-xs">
      <span className="text-[#8892AA] font-mono truncate max-w-[180px]" title={path}>{path}</span>
      <div className="flex items-center gap-4 text-right shrink-0">
        <span className="text-[#F1F3F9] tabular-nums w-16">{metric.count.toLocaleString()} req</span>
        <span className="text-[#8892AA] tabular-nums w-16">{fmt(avg)}ms avg</span>
        {errRate > 0 ? (
          <span className="text-red-400 tabular-nums w-12">{fmt(errRate)}% err</span>
        ) : (
          <span className="text-emerald-400 w-12">0 err</span>
        )}
      </div>
    </div>
  );
}

export function LiveMetricsPanel() {
  const { data, isLoading, isError, refetch, isFetching } = useMetrics();

  const uptimeStr = data
    ? data.uptime_seconds < 60
      ? `${Math.floor(data.uptime_seconds)}s`
      : data.uptime_seconds < 3600
      ? `${Math.floor(data.uptime_seconds / 60)}m`
      : `${(data.uptime_seconds / 3600).toFixed(1)}h`
    : '—';

  const topEndpoints = data
    ? Object.entries(data.endpoints)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 8)
    : [];

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0F1117] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-[#F1F3F9]">Live Metrics</h3>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="p-1.5 rounded-md hover:bg-white/[0.06] text-[#8892AA] hover:text-[#F1F3F9] transition-colors disabled:opacity-40"
          aria-label="Refresh metrics"
        >
          <RefreshCcw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {isLoading && (
        <div className="text-center py-6 text-[#8892AA] text-sm">Loading metrics&hellip;</div>
      )}

      {isError && (
        <div className="flex items-center gap-2 text-red-400 text-sm py-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Could not load metrics</span>
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
            <Stat label="Uptime" value={uptimeStr} />
            <Stat label="Requests" value={data.request_count.toLocaleString()} />
            <Stat label="Errors" value={data.error_count.toLocaleString()} />
            <Stat label="Avg Latency" value={`${fmt(data.avg_latency_ms)}ms`} sub={`${data.active_requests} active`} />
          </div>

          {topEndpoints.length > 0 && (
            <>
              <p className="text-xs text-[#8892AA] mb-2 font-medium uppercase tracking-wider">Top Endpoints</p>
              <div>
                {topEndpoints.map(([path, metric]) => (
                  <EndpointRow key={path} path={path} metric={metric} />
                ))}
              </div>
            </>
          )}

          {topEndpoints.length === 0 && (
            <p className="text-xs text-[#8892AA] py-2">No requests recorded yet.</p>
          )}
        </>
      )}
    </div>
  );
}
