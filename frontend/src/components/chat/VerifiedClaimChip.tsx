'use client';

import React from 'react';
import Link from 'next/link';

import { buildProvenanceHref, formatPercent, getClaimLabel, getClaimTone } from '../../lib/verifiedAnswer';
import type { Claim, Citation } from '../../types/clarity';


const CHIP_STYLES = {
  verified: 'border-emerald-300 bg-emerald-50 text-emerald-950',
  partial: 'border-amber-300 bg-amber-50 text-amber-950',
  unsupported: 'border-rose-300 bg-rose-50 text-rose-950',
  uncertain: 'border-slate-300 bg-slate-100 text-slate-900',
} as const;

const CHIP_SYMBOL = {
  verified: '✓',
  partial: '⚠',
  unsupported: '✕',
  uncertain: '?',
} as const;


export function VerifiedClaimChip({
  claim,
  citations,
  workspaceId,
}: {
  claim: Claim;
  citations: Citation[];
  workspaceId: string;
}) {
  const tone = getClaimTone(claim);
  const label = getClaimLabel(claim);
  const primaryCitation = citations[0];
  const href = primaryCitation
    ? buildProvenanceHref({
        workspaceId,
        documentId: primaryCitation.documentId,
        claimId: claim.id,
        chunkId: primaryCitation.chunkId,
        citationKey: primaryCitation.citationKey,
        claimText: claim.text,
        criticVerdict: claim.criticVerdict ?? null,
        nliScore: claim.nliScore ?? null,
      })
    : undefined;

  const body = (
    <>
      <span aria-hidden="true" className="text-sm">{CHIP_SYMBOL[tone]}</span>
      <span className="font-semibold">{label}</span>
      <span className="text-slate-700">{claim.text}</span>
    </>
  );

  const details = (
    <div className="mt-3 grid gap-2 text-xs text-slate-700">
      <p>
        <span className="font-semibold text-slate-900">Evidence:</span>{' '}
        {primaryCitation
          ? `${primaryCitation.citationKey} · pages ${primaryCitation.pageStart}–${primaryCitation.pageEnd}`
          : 'No citation recorded.'}
      </p>
      <p>
        <span className="font-semibold text-slate-900">Critic verdict:</span> {claim.criticVerdict}
      </p>
      {claim.nliLabel && (
        <p>
          <span className="font-semibold text-slate-900">NLI label:</span> {claim.nliLabel}
        </p>
      )}
      {claim.nliScore != null && (
        <p>
          <span className="font-semibold text-slate-900">NLI score:</span>{' '}
          {formatPercent(claim.nliScore)}
        </p>
      )}
    </div>
  );

  return (
    <details className={`rounded-2xl border px-4 py-3 ${CHIP_STYLES[tone]}`}>
      <summary
        className="flex cursor-pointer list-none flex-wrap items-center gap-2 text-sm"
        aria-label={`${label} claim`}
      >
        {href ? (
          <Link href={href} className="contents">
            {body}
          </Link>
        ) : (
          body
        )}
      </summary>
      {details}
    </details>
  );
}
