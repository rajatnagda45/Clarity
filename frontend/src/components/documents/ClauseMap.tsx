import { FileSearch } from 'lucide-react';
import type { Clause } from '@/types/clarity';

function riskStyle(flag: Clause['riskFlag']): { border: string; bg: string; badge: string; text: string } {
  if (flag === 'flagged')     return { border: 'border-red-500/30',    bg: 'bg-red-500/5',    badge: 'bg-red-500/10 text-red-400 border-red-500/20',    text: 'text-red-400' };
  if (flag === 'non_standard') return { border: 'border-amber-500/30', bg: 'bg-amber-500/5',  badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20', text: 'text-amber-400' };
  return                               { border: 'border-white/[0.06]', bg: 'bg-white/[0.02]', badge: 'bg-white/[0.04] text-[#8892AA] border-white/[0.08]',  text: 'text-[#8892AA]' };
}

export function ClauseMap({ clauses }: { clauses: Clause[] }) {
  if (clauses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-white/[0.08] py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.06]">
          <FileSearch size={20} className="text-[#4A5168]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[#F1F3F9]">No clauses detected</p>
          <p className="mt-1 text-xs text-[#4A5168] max-w-xs mx-auto leading-relaxed">
            Clause extraction is designed for legal documents such as contracts and agreements.
            This document does not contain recognizable clause structure.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {clauses.map((clause) => {
        const s = riskStyle(clause.riskFlag);
        return (
          <article key={clause.id} className={`rounded-xl border ${s.border} ${s.bg} p-4`}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#F1F3F9]">
                  {clause.clauseType.replace(/_/g, ' ')}
                </span>
                <span className="text-[#4A5168] text-xs">·</span>
                <span className="text-xs text-[#8892AA]">Page {clause.page}</span>
                {clause.riskScore !== undefined && (
                  <>
                    <span className="text-[#4A5168] text-xs">·</span>
                    <span className="text-xs text-[#8892AA]">Risk {Math.round(clause.riskScore * 100)}%</span>
                  </>
                )}
              </div>
              <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${s.badge}`}>
                {clause.riskFlag.replace('_', ' ')}
              </span>
            </div>
            <p className="text-sm text-[#C4CBD8] leading-relaxed whitespace-pre-wrap">{clause.text}</p>
            {clause.rationale ? (
              <p className="mt-2 text-xs text-[#8892AA] leading-relaxed">{clause.rationale}</p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
