'use client';

import React from 'react';

import { formatPercent, getSupportRate, getTrustTone, getVerificationPasses } from '../../lib/verifiedAnswer';
import type { Claim, DebateTurn, TrustScore } from '../../types/clarity';


const TONE_STYLES = {
  green: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  amber: 'border-amber-300 bg-amber-50 text-amber-950',
  red: 'border-rose-300 bg-rose-50 text-rose-950',
} as const;


export function TrustBadge({
  trust,
  claims,
  debateTurns,
}: {
  trust: TrustScore | null | undefined;
  claims: Claim[];
  debateTurns: DebateTurn[];
}) {
  if (!trust) return null;

  const tone = getTrustTone(trust);
  const supportRate = getSupportRate(claims);
  const verificationPasses = getVerificationPasses(claims, debateTurns);

  return (
    <details className={`rounded-3xl border p-4 shadow-sm ${TONE_STYLES[tone]}`}>
      <summary
        className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-4"
        aria-label={`Trust score ${formatPercent(trust.confidence)}, band ${trust.confidenceBand}`}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em]">Overall Trust Score</p>
          <div className="mt-2 flex items-end gap-3">
            <span className="text-4xl font-semibold">{formatPercent(trust.confidence)}</span>
            <span className="rounded-full border border-current/20 px-3 py-1 text-sm font-medium">
              {trust.confidenceBand[0].toUpperCase() + trust.confidenceBand.slice(1)}
            </span>
          </div>
        </div>
        <div className="grid min-w-[13rem] grid-cols-2 gap-3 text-sm">
          <div>
            <p className="font-medium">Support Rate</p>
            <p className="mt-1 text-lg">{formatPercent(supportRate)}</p>
          </div>
          <div>
            <p className="font-medium">Verification Passes</p>
            <p className="mt-1 text-lg">{verificationPasses}</p>
          </div>
        </div>
      </summary>

      <div className="mt-4 grid gap-3 border-t border-current/10 pt-4 text-sm">
        <p>
          This score is the calibrated confidence for the full answer, not a raw model feeling. It blends claim support,
          independent verification, and evidence coverage before being shown to the user.
        </p>
        <p>
          Support rate measures how many extracted claims stayed supported after verification. Verification passes show
          how many draft/review rounds the runtime needed before finalizing or abstaining.
        </p>
      </div>
    </details>
  );
}
