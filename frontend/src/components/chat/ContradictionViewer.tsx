'use client';

import React from 'react';
import Link from 'next/link';

import { buildProvenanceHref } from '../../lib/verifiedAnswer';
import type { Contradiction } from '../../types/clarity';


export function ContradictionViewer({
  contradictions,
  workspaceId,
}: {
  contradictions: Contradiction[];
  workspaceId: string;
}) {
  if (contradictions.length === 0) return null;

  return (
    <details className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900" aria-label="Open contradiction viewer">
        Contradiction Viewer
      </summary>
      <div className="mt-4 space-y-4">
        {contradictions.map((contradiction) => (
          <article key={contradiction.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">{contradiction.topic}</h3>
              <span className="rounded-full border border-slate-300 px-3 py-1 text-xs uppercase text-slate-600">
                {contradiction.severity}
              </span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Document A</p>
                <p className="mt-2 text-sm font-medium text-slate-900">{contradiction.docA}</p>
                <p className="mt-2 text-sm text-slate-700">{contradiction.valueA ?? 'No statement recorded.'}</p>
                {contradiction.spanA ? (
                  <Link
                    href={buildProvenanceHref({
                      workspaceId,
                      documentId: contradiction.docA,
                      chunkId: contradiction.spanA,
                    })}
                    className="mt-3 inline-flex text-sm font-medium text-blue-700"
                  >
                    Open citation
                  </Link>
                ) : null}
              </div>
              <div className="rounded-2xl bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Document B</p>
                <p className="mt-2 text-sm font-medium text-slate-900">{contradiction.docB}</p>
                <p className="mt-2 text-sm text-slate-700">{contradiction.valueB ?? 'No statement recorded.'}</p>
                {contradiction.spanB ? (
                  <Link
                    href={buildProvenanceHref({
                      workspaceId,
                      documentId: contradiction.docB,
                      chunkId: contradiction.spanB,
                    })}
                    className="mt-3 inline-flex text-sm font-medium text-blue-700"
                  >
                    Open citation
                  </Link>
                ) : null}
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-600">{contradiction.note ?? 'These statements conflict across documents in the same workspace.'}</p>
          </article>
        ))}
      </div>
    </details>
  );
}
