'use client';

import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { DocumentList } from '@/components/documents/DocumentList';
import { Dropzone } from '@/components/upload/Dropzone';
import { listDocuments, uploadDocument } from '@/lib/api';
import type { Document } from '@/types/clarity';


type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);


export default function DocumentsPage() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get('workspace') ?? '';
  const { getToken } = useAuth();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadDocuments() {
      if (!workspaceId) {
        setLoadState('error');
        setErrorMessage('Choose a workspace from the dashboard before uploading documents.');
        return;
      }

      setLoadState('loading');
      setErrorMessage('');

      try {
        const token = await getToken();
        if (!token) {
          throw new Error('Clerk session token unavailable.');
        }

        const docs = await listDocuments({ token, workspaceId });
        if (cancelled) return;

        setDocuments(docs);
        setLoadState('loaded');
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load documents.');
        setLoadState('error');
      }
    }

    void loadDocuments();
    return () => {
      cancelled = true;
    };
  }, [getToken, workspaceId]);

  async function handleFileSelected(file: File) {
    if (!workspaceId) {
      setErrorMessage('Choose a workspace before uploading documents.');
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      setErrorMessage('File exceeds the 50MB upload limit.');
      return;
    }

    if (file.type && !ALLOWED_TYPES.has(file.type)) {
      setErrorMessage('Only PDF and DOCX documents are supported.');
      return;
    }

    setIsUploading(true);
    setErrorMessage('');

    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Clerk session token unavailable.');
      }

      const created = await uploadDocument({ token, workspaceId }, file);
      setDocuments((current) => [created, ...current]);
      setLoadState('loaded');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-600">Phase A2</p>
        <h1 className="text-3xl font-semibold text-slate-900">Documents</h1>
        <p className="text-sm text-slate-600">
          Upload stores original files securely and persists metadata only. Parsing and AI start in
          later milestones.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">
          Active workspace:{' '}
          <span className="font-mono text-slate-800">{workspaceId || 'not selected'}</span>
        </p>
        {!workspaceId ? (
          <Link
            href="/dashboard"
            className="mt-4 inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            Back to dashboard
          </Link>
        ) : null}
      </div>

      <Dropzone disabled={!workspaceId || isUploading} onFileSelected={handleFileSelected} />

      {isUploading ? <p className="text-sm text-slate-500">Uploading document…</p> : null}
      {loadState === 'loading' ? <p className="text-sm text-slate-500">Loading documents…</p> : null}
      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

      <section className="grid gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Stored documents</h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            {documents.length} total
          </span>
        </div>
        <DocumentList documents={documents} />
      </section>
    </div>
  );
}
