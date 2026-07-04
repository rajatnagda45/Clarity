'use client';

import { useState, useMemo } from 'react';
import { Shield, Download, Search, ChevronDown, AlertCircle, Info } from 'lucide-react';
import { useAuditLogs } from '@/hooks/useEnterprise';
import { formatRelativeTime } from '@/lib/time';
import type { AuditLog } from '@/types/clarity';

const SEVERITY_COLORS: Record<string, string> = {
  info: 'bg-blue-500/10 text-blue-400',
  warning: 'bg-amber-500/10 text-amber-400',
  critical: 'bg-red-500/10 text-red-400',
};

const ACTION_COLORS: Record<string, string> = {
  'document.uploaded': 'text-emerald-400',
  'document.deleted': 'text-red-400',
  'eval.completed': 'text-purple-400',
  'benchmark.completed': 'text-blue-400',
  'member.added': 'text-cyan-400',
  'member.removed': 'text-orange-400',
};

const RESOURCE_TYPE_OPTIONS = ['', 'document', 'collection', 'member', 'workspace', 'eval', 'benchmark'];
const SEVERITY_OPTIONS = ['', 'info', 'warning', 'critical'];

function SeverityBadge({ severity }: { severity: AuditLog['severity'] }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${SEVERITY_COLORS[severity] ?? 'bg-white/[0.04] text-[#4A5168]'}`}>
      {severity === 'critical' && <AlertCircle size={10} />}
      {severity === 'info' && <Info size={10} />}
      {severity}
    </span>
  );
}

function exportLogsAsCsv(logs: AuditLog[]) {
  const header = 'id,timestamp,user_id,action,resource_type,resource_id,severity,ip_address';
  const rows = logs.map(l =>
    [l.id, l.createdAt, l.userId ?? '', l.action, l.resourceType ?? '', l.resourceId ?? '', l.severity, l.ipAddress ?? ''].join(',')
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function AuditLogsTab() {
  const [search, setSearch] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [severity, setSeverity] = useState('');
  const [action, setAction] = useState('');

  const { data, isLoading, isError } = useAuditLogs({
    resourceType: resourceType || undefined,
    severity: severity || undefined,
    action: action || undefined,
    limit: 100,
  });

  const logs = useMemo(() => {
    const all = data?.logs ?? [];
    if (!search.trim()) return all;
    const q = search.toLowerCase();
    return all.filter(l =>
      l.action.toLowerCase().includes(q) ||
      (l.userId ?? '').toLowerCase().includes(q) ||
      (l.resourceType ?? '').toLowerCase().includes(q) ||
      (l.resourceId ?? '').toLowerCase().includes(q)
    );
  }, [data?.logs, search]);

  return (
    <div className="flex flex-col animate-in fade-in duration-500 max-w-5xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Shield size={22} className="text-purple-400" />
            Audit Logs
          </h1>
          <p className="text-sm text-[#8892AA] mt-1">Immutable record of all workspace activity for compliance and investigation.</p>
        </div>
        <button
          onClick={() => exportLogsAsCsv(logs)}
          disabled={logs.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-white/[0.05] border border-white/[0.08] text-[#F1F3F9] rounded-xl text-sm font-medium hover:bg-white/[0.08] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          <Download size={15} />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-5">
        <div className="relative sm:col-span-2">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A5168]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by action, user, resource…"
            className="w-full bg-[#0F1117] border border-white/[0.08] rounded-xl pl-8 pr-3 py-2.5 text-sm text-[#F1F3F9] placeholder:text-[#4A5168] focus:outline-none focus:border-purple-500/50 transition-colors"
          />
        </div>
        {[
          { label: 'Resource', value: resourceType, setter: setResourceType, options: RESOURCE_TYPE_OPTIONS },
          { label: 'Severity', value: severity, setter: setSeverity, options: SEVERITY_OPTIONS },
        ].map(({ label, value, setter, options }) => (
          <div key={label} className="relative">
            <select
              value={value}
              onChange={e => setter(e.target.value)}
              className="w-full appearance-none bg-[#0F1117] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-[#F1F3F9] focus:outline-none focus:border-purple-500/50 transition-colors pr-8"
            >
              <option value="">All {label}s</option>
              {options.filter(Boolean).map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A5168] pointer-events-none" />
          </div>
        ))}
      </div>

      {/* Log Table */}
      <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="space-y-px">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-12 bg-white/[0.02] animate-pulse" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center gap-3 py-12">
            <AlertCircle size={18} className="text-red-400" />
            <p className="text-sm text-red-400">Failed to load audit logs.</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <Shield size={32} className="text-[#4A5168] mb-3" />
            <p className="text-sm font-semibold text-[#F1F3F9] mb-1">No audit events yet</p>
            <p className="text-xs text-[#4A5168]">Events will appear here as your team uses Clarity.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  {['Timestamp', 'User', 'Action', 'Resource', 'Severity', 'IP'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-bold text-[#4A5168] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-[#4A5168] whitespace-nowrap">
                      {formatRelativeTime(log.createdAt)}
                    </td>
                    <td className="px-4 py-3 font-mono text-[#8892AA] max-w-[120px] truncate">
                      {log.userId ? log.userId.slice(0, 12) + '…' : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold whitespace-nowrap">
                      <span className={ACTION_COLORS[log.action] ?? 'text-[#F1F3F9]'}>{log.action}</span>
                    </td>
                    <td className="px-4 py-3 text-[#8892AA] max-w-[120px] truncate">
                      {log.resourceType ? `${log.resourceType}` : '—'}
                      {log.resourceId && <span className="text-[#4A5168] font-mono"> /{log.resourceId.slice(0, 8)}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <SeverityBadge severity={log.severity} />
                    </td>
                    <td className="px-4 py-3 font-mono text-[#4A5168]">{log.ipAddress ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {logs.length > 0 && (
        <p className="mt-3 text-xs text-[#4A5168] text-right">{logs.length} events shown</p>
      )}
    </div>
  );
}
