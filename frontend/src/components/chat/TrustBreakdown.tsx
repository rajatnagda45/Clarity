'use client';

import React from 'react';

import { buildTrustBreakdown, formatPercent } from '../../lib/verifiedAnswer';
import type { Claim, RetrievalEvidence, TrustScore } from '../../types/clarity';


export function TrustBreakdown({
  trust,
  claims,
  retrievedEvidence,
}: {
  trust: TrustScore | null | undefined;
  claims: Claim[];
  retrievedEvidence: RetrievalEvidence[];
}) {
  if (!trust) return null;

  const items = buildTrustBreakdown(trust, claims, retrievedEvidence);

  return (
    <details className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900" aria-label="Open trust breakdown">
        Trust Breakdown
      </summary>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-slate-900">{item.label}</p>
              <span className="text-sm text-slate-700">{item.id === 'calibration' ? (item.value ? 'Calibrated' : 'Raw') : formatPercent(item.value)}</span>
            </div>
            <p className="mt-2 text-sm text-slate-600">{item.description}</p>
          </article>
        ))}
      </div>
    </details>
  );
}
