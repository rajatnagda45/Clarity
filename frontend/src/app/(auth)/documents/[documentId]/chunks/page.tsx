'use client';

import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

import { listDocumentChunks } from '@/lib/api';
import type { DocumentChunk } from '@/types/clarity';


type LoadState = 'idle' | 'loading' | 'loaded' | 'error';


export default function DocumentChunkInspectorPage() {
  const params = useParams<{ documentId: string }>();
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get('workspace') ?? '';
  const highlightedChunkId = searchParams.get('highlight') ?? '';
  const { getToken } = useAuth();

  const [chunks, setChunks] = useState<DocumentChunk[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadChunks() {
      if (!workspaceId) {
        setLoadState('error');
        setErrorMessage('Chunk inspector requires an active workspace.');
        return;
      }

      setLoadState('loading');
      setErrorMessage('');

      try {
        const token = await getToken();
        if (!token) {
          throw new Error('Clerk session token unavailable.');
        }

        const nextChunks = await listDocumentChunks(
          { token, workspaceId },
          params.documentId,
        );

        if (cancelled) return;
        setChunks(nextChunks);
        setLoadState('loaded');
      } catch (error) {
        if (cancelled) return;
        setLoadState('error');
        setErrorMessage(
          error instanceof Error ? error.message : 'Failed to load chunk inspector data.',
        );
      }
    }

    void loadChunks();
    return () => {
      cancelled = true;
    };
  }, [getToken, params.documentId, workspaceId]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-600">
            Developer Chunk Inspector
          </p>
          <h1 className="text-3xl font-semibold text-slate-900">Document chunks</h1>
          <p className="text-sm text-slate-600">
            Review deterministic chunk ordering, clause metadata, page coverage, token counts, and
            checksums before retrieval or embeddings are introduced.
          </p>
        </div>
        <Link
          href={workspaceId ? `/documents?workspace=${encodeURIComponent(workspaceId)}` : '/documents'}
          className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
        >
          Back to documents
        </Link>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-2 text-sm text-slate-600 md:grid-cols-3">
          <p>
            Workspace: <span className="font-mono text-slate-900">{workspaceId || 'missing'}</span>
          </p>
          <p>
            Document: <span className="font-mono text-slate-900">{params.documentId}</span>
          </p>
          <p>
            Chunks: <span className="font-semibold text-slate-900">{chunks.length}</span>
          </p>
        </div>
      </div>

      {loadState === 'loading' ? <p className="text-sm text-slate-500">Loading chunks…</p> : null}
      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

      {loadState === 'loaded' && chunks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
          <p className="text-sm text-slate-600">
            No chunks are stored for this document yet. Finish ingestion first, then reopen the
            inspector.
          </p>
        </div>
      ) : null}

      <section className="grid gap-4">
        {chunks.map((chunk) => (
          <article
            key={chunk.chunkId}
            id={`chunk-${chunk.chunkId}`}
            className={`rounded-3xl border bg-white p-6 shadow-sm ${
              highlightedChunkId === chunk.chunkId
                ? 'border-blue-500 ring-2 ring-blue-200'
                : 'border-slate-200'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                    chunk {chunk.chunkIndex}
                  </span>
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                    {chunk.chunkKind}
                  </span>
                  {chunk.clauseNumber ? (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                      clause {chunk.clauseNumber}
                    </span>
                  ) : null}
                </div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {chunk.sectionTitle || 'Untitled section'}
                </h2>
              </div>
              <div className="space-y-1 text-right text-xs text-slate-500">
                <p>{chunk.tokenCount} tokens</p>
                <p>
                  pages {chunk.pageStart}–{chunk.pageEnd}
                </p>
                <p>
                  fragment {chunk.fragmentIndex + 1}/{chunk.fragmentCount}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
              <p>
                Chunk ID: <span className="font-mono text-slate-900">{chunk.chunkId}</span>
              </p>
              <p>
                Checksum: <span className="font-mono text-slate-900">{chunk.checksum}</span>
              </p>
              <p>
                Parser version: <span className="font-mono text-slate-900">{chunk.parserVersion}</span>
              </p>
              <p>
                Chunk version: <span className="font-mono text-slate-900">{chunk.chunkVersion}</span>
              </p>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <h3 className="text-sm font-semibold text-slate-900">Cross references</h3>
                <p className="mt-2 text-sm text-slate-600">
                  {chunk.crossReferences.length > 0 ? chunk.crossReferences.join(', ') : 'None'}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <h3 className="text-sm font-semibold text-slate-900">Source offsets</h3>
                <ul className="mt-2 space-y-1 text-sm text-slate-600">
                  {chunk.sourceOffsets.map((offset, index) => (
                    <li key={`${chunk.chunkId}-${index}`} className="font-mono">
                      p{offset.page} b{offset.blockOrder} {offset.charStart}-{offset.charEnd}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-slate-950 p-4 text-sm leading-6 text-slate-100">
              <pre className="whitespace-pre-wrap break-words font-mono">{chunk.text}</pre>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
