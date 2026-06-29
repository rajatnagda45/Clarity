'use client';

import React from 'react';

import type { DebateTurn } from '../../types/clarity';


const ACTION_LABELS: Record<DebateTurn['action'], string> = {
  draft: 'Writer Draft',
  flag: 'Critic Review',
  revise: 'Revision',
  reretrieve: 'Verification',
  resolve: 'Final Answer',
};


export function DebatePanel({ debateTurns }: { debateTurns: DebateTurn[] }) {
  if (debateTurns.length === 0) return null;

  return (
    <details className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900" aria-label="Open debate timeline">
        Debate Timeline
      </summary>
      <ol className="mt-4 space-y-3">
        {debateTurns.map((turn, index) => (
          <li key={`${turn.actor}-${turn.action}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">{ACTION_LABELS[turn.action]}</p>
              <div className="text-right text-xs uppercase tracking-[0.16em] text-slate-500">
                <p>pass {turn.round + 1} · {turn.actor}</p>
                <p>{turn.createdAt ? new Date(turn.createdAt).toLocaleTimeString() : 'runtime stream'}</p>
              </div>
            </div>
            <p className="mt-2 text-sm text-slate-700">{turn.note ?? 'No additional details recorded.'}</p>
            {turn.claimId ? <p className="mt-2 text-xs text-slate-500">Claim: {turn.claimId}</p> : null}
          </li>
        ))}
      </ol>
    </details>
  );
}
