'use client';

import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink, FileText } from 'lucide-react';

import { ClauseMap } from '@/components/documents/ClauseMap';
import { getDocument, getDocumentFile } from '@/lib/api';
import type { DocumentDetail, DocumentFile } from '@/types/clarity';
import { useWorkspace } from '@/contexts/WorkspaceContext';


export default function DocumentDetailPage() {
  const params = useParams<{ documentId: string }>();
  const searchParams = useSearchParams();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = searchParams.get('workspace') || activeWorkspace?.id || '';
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
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
            <FileText size={20} className="text-[#8892AA]" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4A5168] mb-1">Document Review</p>
            <h1 className="text-2xl font-bold text-[#F1F3F9] tracking-tight">{document?.filename ?? 'Document'}</h1>
          </div>
        </div>
        <Link
          href={workspaceId ? `/documents?workspace=${encodeURIComponent(workspaceId)}` : '/documents'}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/[0.08] bg-white/[0.02] text-sm font-medium text-[#8892AA] hover:text-[#F1F3F9] hover:bg-white/[0.06] transition-all"
        >
          <ArrowLeft size={14} />
          Back to documents
        </Link>
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          {errorMessage}
        </div>
      ) : null}

      {/* Source file */}
      {documentFile ? (
        <div className="rounded-2xl border border-white/[0.06] bg-[#0F1117] p-6">
          <p className="text-sm text-[#8892AA] leading-relaxed">
            Signed document access is available for provenance review and source verification.
          </p>
          <a
            href={documentFile.signedUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/[0.08] bg-white/[0.02] text-sm font-medium text-[#F1F3F9] hover:bg-white/[0.06] transition-all"
          >
            <ExternalLink size={14} />
            Open source file
          </a>
        </div>
      ) : null}

      {/* Clause map */}
      {document ? (
        <section className="rounded-2xl border border-white/[0.06] bg-[#0F1117] p-6">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-[#F1F3F9]">Clause map</h2>
            <p className="mt-1 text-sm text-[#8892AA]">
              Legal clause structure extracted during ingestion, with risk classification and page references.
            </p>
          </div>
          <ClauseMap clauses={document.clauses} />
        </section>
      ) : null}
    </div>
  );
}
