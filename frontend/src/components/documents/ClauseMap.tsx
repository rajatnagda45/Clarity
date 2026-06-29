import type { Clause } from '@/types/clarity';


function tone(flag: Clause['riskFlag']): string {
  if (flag === 'flagged') return 'border-red-200 bg-red-50 text-red-700';
  if (flag === 'non_standard') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}


export function ClauseMap({ clauses }: { clauses: Clause[] }) {
  if (clauses.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
        Clause extraction has not produced any structured clauses for this document yet.
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {clauses.map((clause) => (
        <article key={clause.id} className={`rounded-2xl border p-4 ${tone(clause.riskFlag)}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em]">{clause.clauseType}</p>
              <p className="mt-1 text-sm">
                Page {clause.page} · Risk {clause.riskFlag.replace('_', ' ')}
                {clause.riskScore !== undefined ? ` · Score ${Math.round(clause.riskScore * 100)}%` : ''}
              </p>
            </div>
            <span className="rounded-full border border-current px-3 py-1 text-xs font-medium">
              {clause.riskFlag}
            </span>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-800">{clause.text}</p>
          {clause.rationale ? (
            <p className="mt-3 text-xs text-slate-600">{clause.rationale}</p>
          ) : null}
        </article>
      ))}
    </div>
  );
}
