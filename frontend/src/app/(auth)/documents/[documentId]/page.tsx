'use client';

import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ClauseMap } from '@/components/documents/ClauseMap';
import { getDocument, getDocumentFile } from '@/lib/api';
import type { DocumentDetail, DocumentFile } from '@/types/clarity';


export default function DocumentDetailPage() {
  const params = useParams<{ documentId: string }>();
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get('workspace') ?? '';
  const { getToken } = useAuth();

  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [documentFile, setDocumentFile] = useState<DocumentFile | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!workspaceId) {
        setErrorMessage('Choose a workspace before opening documents.');
        return;
      }
      try {
        const token = await getToken();
        if (!token) throw new Error('Clerk session token unavailable.');
        const [detail, file] = await Promise.all([
          getDocument({ token, workspaceId }, params.documentId),
          getDocumentFile({ token, workspaceId }, params.documentId),
        ]);
        if (cancelled) return;
        setDocument(detail);
        setDocumentFile(file);
        setErrorMessage('');
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load document.');
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [getToken, params.documentId, workspaceId]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-600">Document Review</p>
          <h1 className="text-3xl font-semibold text-slate-900">{document?.filename ?? 'Document'}</h1>
        </div>
        <Link
          href={workspaceId ? `/documents?workspace=${encodeURIComponent(workspaceId)}` : '/documents'}
          className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
        >
          Back to documents
        </Link>
      </div>

      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

      {documentFile ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">
            Signed document access is available for provenance review and source verification.
          </p>
          <a
            href={documentFile.signedUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            Open source file
          </a>
        </div>
      ) : null}

      {document ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-xl font-semibold text-slate-900">Clause map</h2>
            <p className="mt-1 text-sm text-slate-600">
              Structured clauses generated from the current ingestion pipeline, with clause typing and risk flags.
            </p>
          </div>
          <ClauseMap clauses={document.clauses} />
        </section>
      ) : null}
    </div>
  );
}
