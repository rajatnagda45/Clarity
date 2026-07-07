'use client';

import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

export const CHART_COLORS = ['#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#EC4899'];

export const TOOLTIP_STYLE = {
  contentStyle: { background: '#0F1117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 },
  labelStyle: { color: '#F1F3F9' },
};

export function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
  delta,
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

export function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-bold text-[#F1F3F9]">{title}</h2>
      {sub && <p className="text-sm text-[#8892AA] mt-0.5">{sub}</p>}
    </div>
  );
}

export function EvalEmptyState({
  icon: Icon,
  title,
  sub,
}: {
  icon: React.ElementType;
  title: string;
  sub: string;
}) {
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

export function LoadingGrid({ cols = 4, rows = 1 }: { cols?: number; rows?: number }) {
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
