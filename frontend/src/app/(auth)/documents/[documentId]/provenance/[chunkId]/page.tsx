'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAuth } from '@clerk/nextjs';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { getClaimSpans, getDocumentFile } from '@/lib/api';
import { formatPercent } from '@/lib/verifiedAnswer';
import type { DocumentFile, SpanRef } from '@/types/clarity';
import { useWorkspace } from '@/contexts/WorkspaceContext';


const PdfEvidenceViewer = dynamic(
  () => import('@/components/provenance/PdfEvidenceViewer').then((module) => module.PdfEvidenceViewer),
  { ssr: false },
);


export default function ProvenanceViewerPage() {
  const params = useParams<{ documentId: string; chunkId: string }>();
  const searchParams = useSearchParams();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = searchParams.get('workspace') || activeWorkspace?.id || '';
  const citationKey = searchParams.get('citationKey');
  const claimText = searchParams.get('claimText');
  const criticStatus = searchParams.get('criticStatus');
  const confidence = searchParams.get('confidence');
  const supportProbability = searchParams.get('supportProbability');
  const { getToken } = useAuth();

  const [documentFile, setDocumentFile] = useState<DocumentFile | null>(null);
  const [spans, setSpans] = useState<SpanRef[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!workspaceId) {
        setErrorMessage('Choose a workspace before opening provenance.');
        return;
      }
      try {
        const token = await getToken();
        if (!token) throw new Error('Clerk session token unavailable.');
        const [file, nextSpans] = await Promise.all([
          getDocumentFile({ token, workspaceId }, params.documentId),
          getClaimSpans({ token, workspaceId }, params.chunkId),
        ]);
        if (cancelled) return;
        setDocumentFile(file);
        setSpans(nextSpans);
        setCurrentPage(nextSpans[0]?.page ?? 1);
        setErrorMessage('');
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load provenance.');
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [getToken, params.chunkId, params.documentId, workspaceId]);

  const visibleSpans = useMemo(
    () => spans.filter((span) => span.page === currentPage),
    [currentPage, spans],
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-purple-400">Provenance Viewer</p>
          <h1 className="text-3xl font-semibold text-[#F1F3F9]">Exact source evidence</h1>
        </div>
        <Link
          href={`/documents/${params.documentId}?workspace=${encodeURIComponent(workspaceId)}`}
          className="inline-flex rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-sm font-medium text-[#8892AA] transition-colors hover:bg-white/[0.08] hover:text-[#F1F3F9]"
        >
          Back to document
        </Link>
      </div>

      {errorMessage ? <p className="text-sm text-red-400">{errorMessage}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <PdfEvidenceViewer
          currentPage={currentPage}
          documentFile={documentFile}
          onPreviousPage={() => setCurrentPage((page) => Math.max(1, page - 1))}
          onNextPage={() => setCurrentPage((page) => page + 1)}
        />

        <section className="space-y-4">
          <article className="rounded-3xl border border-white/[0.06] bg-[#0F1117] p-6">
            <h2 className="text-xl font-semibold text-[#F1F3F9]">Claim details</h2>
            <div className="mt-4 grid gap-3 text-sm text-[#8892AA]">
              <p><span className="font-semibold text-[#F1F3F9]">Citation:</span> {citationKey ?? 'Direct span lookup'}</p>
              <p><span className="font-semibold text-[#F1F3F9]">Verification:</span> {criticStatus ?? 'Unknown'}</p>
              <p><span className="font-semibold text-[#F1F3F9]">Confidence:</span> {formatPercent(confidence ? Number(confidence) : null)}</p>
              <p><span className="font-semibold text-[#F1F3F9]">Support probability:</span> {formatPercent(supportProbability ? Number(supportProbability) : null)}</p>
            </div>
            {claimText ? (
              <p className="mt-4 whitespace-pre-wrap rounded-2xl bg-[#05070B] p-4 text-sm leading-7 text-[#C8D0E0]">
                {claimText}
              </p>
            ) : null}
          </article>

          <article className="rounded-3xl border border-white/[0.06] bg-[#0F1117] p-6">
            <h2 className="text-xl font-semibold text-[#F1F3F9]">Exact highlighted spans</h2>
            <p className="mt-1 text-sm text-[#8892AA]">
              These spans come directly from stored source offsets for this citation or claim.
            </p>
            <div className="mt-5 space-y-4">
              {visibleSpans.map((span, index) => (
                <article key={`${span.chunkId}-${index}`} className="rounded-2xl border border-purple-500/20 bg-purple-500/[0.06] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-purple-400">
                    Page {span.page} · chars {span.charStart}-{span.charEnd}
                  </p>
                  <p className="mt-2 text-xs text-[#4A5168]">Rerank score: {formatPercent(span.rerankScore)}</p>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#C8D0E0]">{span.text}</p>
                </article>
              ))}
              {visibleSpans.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/[0.06] bg-[#05070B] p-4 text-sm text-[#8892AA]">
                  No exact spans are mapped to this page.
                </div>
              ) : null}
            </div>
          </article>
        </section>
      </div>
    </div>
  );
}
