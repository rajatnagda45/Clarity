'use client';

import React from 'react';

import type { VerificationTimelineStep } from '../../lib/verifiedAnswer';


const STEP_STYLES = {
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  running: 'border-blue-200 bg-blue-50 text-blue-950',
  failed: 'border-rose-200 bg-rose-50 text-rose-950',
  skipped: 'border-slate-200 bg-slate-50 text-slate-700',
} as const;


export function VerificationTimeline({ steps }: { steps: VerificationTimelineStep[] }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Verification timeline">
      <h3 className="text-sm font-semibold text-slate-900">Verification Timeline</h3>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {steps.map((step) => (
          <article key={step.id} className={`rounded-2xl border p-4 ${STEP_STYLES[step.status]}`}>
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold">{step.label}</p>
              <span className="rounded-full border border-current/20 px-2 py-0.5 text-xs uppercase">
                {step.status}
              </span>
            </div>
            <p className="mt-2 text-sm">{step.summary}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
