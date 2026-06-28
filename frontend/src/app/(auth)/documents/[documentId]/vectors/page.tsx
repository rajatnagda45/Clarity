'use client';

import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

import { getDocumentVectorIndex } from '@/lib/api';
import type { DocumentVectorIndexInspector } from '@/types/clarity';


type LoadState = 'idle' | 'loading' | 'loaded' | 'error';


export default function DocumentVectorExplorerPage() {
  const params = useParams<{ documentId: string }>();
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get('workspace') ?? '';
  const { getToken } = useAuth();

  const [inspector, setInspector] = useState<DocumentVectorIndexInspector | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadVectors() {
      if (!workspaceId) {
        setLoadState('error');
        setErrorMessage('Vector index explorer requires an active workspace.');
        return;
      }

      setLoadState('loading');
      setErrorMessage('');

      try {
        const token = await getToken();
        if (!token) {
          throw new Error('Clerk session token unavailable.');
        }

        const nextInspector = await getDocumentVectorIndex({ token, workspaceId }, params.documentId);
        if (cancelled) return;
        setInspector(nextInspector);
        setLoadState('loaded');
      } catch (error) {
        if (cancelled) return;
        setLoadState('error');
        setErrorMessage(
          error instanceof Error ? error.message : 'Failed to load vector index explorer data.',
        );
      }
    }

    void loadVectors();
    return () => {
      cancelled = true;
    };
  }, [getToken, params.documentId, workspaceId]);

  const vectors = inspector?.vectors ?? [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-600">
            Developer Vector Index Explorer
          </p>
          <h1 className="text-3xl font-semibold text-slate-900">Indexed vectors</h1>
          <p className="text-sm text-slate-600">
            Inspect synchronization status, provider metadata, namespaces, version ownership, and
            vector identity before retrieval is introduced.
          </p>
        </div>
        <Link
          href={workspaceId ? `/developer/dashboard?workspace=${encodeURIComponent(workspaceId)}` : '/documents'}
          className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
        >
          Back to developer dashboard
        </Link>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-2 xl:grid-cols-4">
          <p>
            Workspace: <span className="font-mono text-slate-900">{workspaceId || 'missing'}</span>
          </p>
          <p>
            Document: <span className="font-mono text-slate-900">{params.documentId}</span>
          </p>
          <p>
            Current provider:{' '}
            <span className="font-mono text-slate-900">{inspector?.currentIndexProvider ?? 'not set'}</span>
          </p>
          <p>
            Current index:{' '}
            <span className="font-mono text-slate-900">{inspector?.currentIndexName ?? 'not set'}</span>
          </p>
          <p className="md:col-span-2 xl:col-span-4">
            Namespace:{' '}
            <span className="font-mono text-slate-900">{inspector?.currentIndexNamespace ?? 'not set'}</span>
          </p>
        </div>
      </div>

      {loadState === 'loading' ? <p className="text-sm text-slate-500">Loading vectors…</p> : null}
      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

      {loadState === 'loaded' && vectors.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
          <p className="text-sm text-slate-600">
            No vector index records are stored for this document yet. Complete the A6 lifecycle and
            reopen the explorer.
          </p>
        </div>
      ) : null}

      <section className="grid gap-4">
        {vectors.map((vector) => (
          <article key={`${vector.vectorId}-${vector.indexedAt ?? 'pending'}`} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                    chunk {vector.chunkIndex}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      vector.status === 'current'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {vector.status}
                  </span>
                </div>
                <h2 className="text-lg font-semibold text-slate-900">{vector.vectorId}</h2>
              </div>
              <div className="space-y-1 text-right text-xs text-slate-500">
                <p>{vector.embeddingDimension} dimensions</p>
                <p>{vector.latencyMs ?? 0} ms latency</p>
                <p>{vector.retryCount} retries</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2 xl:grid-cols-3">
              <p>Namespace: <span className="font-mono text-slate-900">{vector.namespace}</span></p>
              <p>Provider: <span className="font-mono text-slate-900">{vector.indexProvider}</span></p>
              <p>Index: <span className="font-mono text-slate-900">{vector.indexName}</span></p>
              <p>Embedding provider: <span className="font-mono text-slate-900">{vector.embeddingProvider}</span></p>
              <p>Embedding model: <span className="font-mono text-slate-900">{vector.embeddingModel}</span></p>
              <p>Embedding version: <span className="font-mono text-slate-900">{vector.embeddingVersion}</span></p>
              <p>Parser version: <span className="font-mono text-slate-900">{vector.parserVersion}</span></p>
              <p>Chunk version: <span className="font-mono text-slate-900">{vector.chunkVersion}</span></p>
              <p>Checksum: <span className="font-mono text-slate-900">{vector.checksum}</span></p>
              <p>Section title: <span className="font-mono text-slate-900">{vector.sectionTitle ?? 'n/a'}</span></p>
              <p>Clause number: <span className="font-mono text-slate-900">{vector.clauseNumber ?? 'n/a'}</span></p>
              <p>Pages: <span className="font-mono text-slate-900">{vector.pageStart}–{vector.pageEnd}</span></p>
              <p className="md:col-span-2 xl:col-span-3">
                Indexed at:{' '}
                <span className="font-mono text-slate-900">
                  {vector.indexedAt ? new Date(vector.indexedAt).toLocaleString() : 'not indexed'}
                </span>
              </p>
            </div>

            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
              <p className="mb-2 font-semibold text-slate-900">Chunk preview</p>
              <p className="whitespace-pre-wrap break-words">{vector.chunkText}</p>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
