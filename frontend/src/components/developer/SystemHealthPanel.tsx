'use client';

import { CheckCircle2, XCircle, AlertTriangle, RefreshCcw } from 'lucide-react';
import { useSystemHealth } from '@/hooks/useSystemHealth';
import type { SystemHealth, HealthProbeResult } from '@/types/clarity';

function statusColor(status: SystemHealth['status']) {
  if (status === 'ready') return 'text-emerald-400';
  if (status === 'degraded') return 'text-amber-400';
  return 'text-red-400';
}

function statusBg(status: SystemHealth['status']) {
  if (status === 'ready') return 'bg-emerald-500/10 border-emerald-500/20';
  if (status === 'degraded') return 'bg-amber-500/10 border-amber-500/20';
  return 'bg-red-500/10 border-red-500/20';
}

function ProbeRow({ name, probe }: { name: string; probe: HealthProbeResult }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
      <div className="flex items-center gap-2">
        {probe.ok ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        ) : (
          <XCircle className="w-4 h-4 text-red-400" />
        )}
        <span className="text-sm text-[#8892AA] capitalize">{name}</span>
      </div>
      <div className="flex items-center gap-3 text-xs">
        {probe.latency_ms != null && (
          <span className="text-[#8892AA]">{probe.latency_ms.toFixed(1)}ms</span>
        )}
        {probe.detail && (
          <span className="text-red-400 max-w-[180px] truncate" title={probe.detail}>
            {probe.detail}
          </span>
        )}
        <span className={probe.ok ? 'text-emerald-400' : 'text-red-400'}>
          {probe.ok ? 'ok' : 'fail'}
        </span>
      </div>
    </div>
  );
}

export function SystemHealthPanel() {
  const { data, isLoading, isError, refetch, isFetching } = useSystemHealth();

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0F1117] p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[#F1F3F9]">System Health</h3>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="p-1.5 rounded-md hover:bg-white/[0.06] text-[#8892AA] hover:text-[#F1F3F9] transition-colors disabled:opacity-40"
          aria-label="Refresh health status"
        >
          <RefreshCcw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {isLoading && (
        <div className="text-center py-6 text-[#8892AA] text-sm">Checking health&hellip;</div>
      )}

      {isError && !data && (
        <div className="flex items-center gap-2 text-red-400 text-sm py-3">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Backend unreachable</span>
        </div>
      )}

      {data && (
        <>
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium mb-4 ${statusBg(data.status)}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${data.status === 'ready' ? 'bg-emerald-400' : data.status === 'degraded' ? 'bg-amber-400' : 'bg-red-400'}`} />
            <span className={statusColor(data.status)}>{data.status}</span>
          </div>

          <div className="space-y-0">
            {Object.entries(data.checks).map(([name, probe]) => (
              <ProbeRow key={name} name={name} probe={probe} />
            ))}
          </div>

          <div className="mt-3 flex gap-4 text-xs text-[#8892AA]">
            <span>v{data.version}</span>
            <span>{data.environment}</span>
          </div>
        </>
      )}
    </div>
  );
}
