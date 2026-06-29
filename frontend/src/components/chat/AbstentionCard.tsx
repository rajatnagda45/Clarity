'use client';

import React from 'react';

import { formatPercent, getAbstentionFollowUp } from '../../lib/verifiedAnswer';
import type { Abstention, TrustScore } from '../../types/clarity';


export function AbstentionCard({
  abstention,
  trust,
  onRefineQuestion,
}: {
  abstention: Abstention;
  trust: TrustScore | null | undefined;
  onRefineQuestion?: (question: string) => void;
}) {
  const followUp = getAbstentionFollowUp(abstention);

  return (
    <section className="rounded-3xl border border-amber-300 bg-amber-50 p-5 text-amber-950 shadow-sm" aria-label="Abstention explanation">
      <p className="text-xs font-semibold uppercase tracking-[0.2em]">Abstention</p>
      <h3 className="mt-2 text-xl font-semibold">I don&apos;t have enough evidence.</h3>
      <p className="mt-3 text-sm leading-7">{abstention.reason}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <article className="rounded-2xl border border-amber-200 bg-white/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em]">Confidence</p>
          <p className="mt-2 text-lg font-semibold">{formatPercent(trust?.confidence)}</p>
        </article>
        <article className="rounded-2xl border border-amber-200 bg-white/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em]">Recommended Follow-up</p>
          <p className="mt-2 text-sm">{followUp ?? 'Refine the question with a clause name, section, or timeframe.'}</p>
        </article>
      </div>
      {followUp && onRefineQuestion ? (
        <button
          type="button"
          onClick={() => onRefineQuestion(followUp)}
          className="mt-4 rounded-full border border-amber-500 px-4 py-2 text-sm font-medium"
        >
          Refine Question
        </button>
      ) : null}
    </section>
  );
}
