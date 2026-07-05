'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/contexts/ToastContext';
import { DocumentList } from '@/components/documents/DocumentList';
import { Dropzone } from '@/components/upload/Dropzone';
import { WorkspaceInsights } from '@/components/documents/WorkspaceInsights';
import { listDocuments, uploadDocument } from '@/lib/api';
import { shouldPollDocuments, shouldStartPollingForUpload } from '@/lib/documentPolling';
import type { Document } from '@/types/clarity';
import { PremiumBackground } from '@/components/landing/PremiumBackground';
import { Search, SlidersHorizontal, LayoutGrid, List, UploadCloud } from 'lucide-react';

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export default function DocumentsPage() {
  const searchParams = useSearchParams();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = searchParams.get('workspace') || activeWorkspace?.id || '';
  const { getToken } = useAuth();
  const { toast } = useToast();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [pollRefreshKey, setPollRefreshKey] = useState(0);
  const [globalDragActive, setGlobalDragActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Ref for global drag counter to prevent flicker when dragging over children
  const dragCounter = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;

    async function loadDocuments(showLoading = true) {
      if (!workspaceId) {
        setLoadState('error');
        return;
      }

      if (showLoading) setLoadState('loading');

      try {
        const token = await getToken();
        if (!token) throw new Error('Clerk session token unavailable.');

        const docs = await listDocuments({ token, workspaceId });
        if (cancelled) return;

        setDocuments(docs);
        setLoadState('loaded');

        if (shouldPollDocuments(docs)) {
          pollTimer = setTimeout(() => void loadDocuments(false), 2000);
        }
      } catch (error) {
        if (cancelled) return;
        toast.error(error instanceof Error ? error.message : 'Failed to load documents.');
        setLoadState('error');
      }
    }

    void loadDocuments();
    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getToken, workspaceId, pollRefreshKey]);

  // Global Drag Events
  useEffect(() => {
    function handleDragEnter(e: DragEvent) {
      e.preventDefault();
      dragCounter.current += 1;
      if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
        setGlobalDragActive(true);
      }
    }
    function handleDragLeave(e: DragEvent) {
      e.preventDefault();
      dragCounter.current -= 1;
      if (dragCounter.current === 0) {
        setGlobalDragActive(false);
      }
    }
    function handleDragOver(e: DragEvent) {
      e.preventDefault();
    }
    function handleDrop(e: DragEvent) {
      e.preventDefault();
      dragCounter.current = 0;
      setGlobalDragActive(false);
      
      if (!disabled && e.dataTransfer?.files) {
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
          void handleFilesSelected(files);
        }
      }
    }

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }); // Note: omitting deps to always have fresh disabled state in closure, though it's better to use refs.

  const disabled = !workspaceId || isUploading;

  const filteredDocuments = searchQuery.trim()
    ? documents.filter((d) =>
        d.filename.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : documents;

  function handleDocumentDeleted(id: string) {
    setDocuments((current) => current.filter((d) => d.id !== id));
  }

  async function handleFilesSelected(files: File[]) {
    if (!workspaceId) {
      toast.error('Choose a workspace before uploading documents.');
      return;
    }

    const validFiles = files.filter(file => {
      if (file.size > MAX_UPLOAD_BYTES) {
        toast.error(`File ${file.name} exceeds the 50MB limit.`);
        return false;
      }
      if (file.type && !ALLOWED_TYPES.has(file.type)) {
        toast.error(`File ${file.name} is not a supported format.`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setIsUploading(true);

    try {
      const token = await getToken();
      if (!token) throw new Error('Clerk session token unavailable.');

      // Sequential Upload Queue
      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        if (validFiles.length > 1) {
          setUploadProgressText(`Uploading ${i + 1} of ${validFiles.length}...`);
        } else {
          setUploadProgressText('Uploading...');
        }
        
        const created = await uploadDocument({ token, workspaceId }, file);
        setDocuments((current) => [created, ...current]);
        
        if (shouldStartPollingForUpload(created)) {
          setPollRefreshKey((current) => current + 1);
        }
      }
      setLoadState('loaded');
      toast.success(`Successfully uploaded ${validFiles.length} document${validFiles.length > 1 ? 's' : ''}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setIsUploading(false);
      setUploadProgressText('');
    }
  }

  return (
    <div className="relative min-h-screen bg-[#05070B] selection:bg-purple-500/30 selection:text-white">
      <PremiumBackground glowOpacity={0.2} />

      {/* Global Drag Overlay */}
      <AnimatePresence>
        {globalDragActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#05070B]/80 backdrop-blur-md border-[4px] border-purple-500/50 m-4 rounded-[32px]"
          >
            <div className="flex flex-col items-center pointer-events-none text-purple-400">
              <UploadCloud size={64} className="mb-6 animate-bounce" />
              <h2 className="text-4xl font-bold text-white tracking-tight">Drop files to upload</h2>
              <p className="text-[#8892AA] mt-4">Release to instantly add to {activeWorkspace?.name || 'workspace'}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-8 px-6 py-8 relative z-10">
        
        {/* Header Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.04] pb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-[#F1F3F9] tracking-tight">Documents</h1>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06]">
              <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
              <span className="text-xs font-medium text-[#8892AA]">{activeWorkspace?.name || 'Loading workspace...'}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8892AA]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documents..."
                className="bg-[#0F1117] border border-white/[0.08] rounded-xl pl-9 pr-4 py-2 text-sm text-[#F1F3F9] placeholder:text-[#4A5168] focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 w-64 transition-all"
              />
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="p-2 rounded-xl border border-white/[0.08] bg-[#0F1117] text-[#8892AA] hover:text-[#F1F3F9] hover:bg-white/[0.04] transition-all"
                title="Clear search"
              >
                <SlidersHorizontal size={16} />
              </button>
            )}
            <div className="flex items-center p-1 rounded-xl border border-white/[0.08] bg-[#0F1117]">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white/[0.06] text-[#F1F3F9]' : 'text-[#4A5168] hover:text-[#8892AA]'}`}
                title="Grid view"
              >
                <LayoutGrid size={14} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white/[0.06] text-[#F1F3F9]' : 'text-[#4A5168] hover:text-[#8892AA]'}`}
                title="List view"
              >
                <List size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Hero Dropzone */}
        <Dropzone 
          disabled={disabled} 
          onFilesSelected={handleFilesSelected} 
          isUploading={isUploading}
          uploadProgressText={uploadProgressText}
        />

        {/* Document Library */}
        <section className="flex flex-col gap-6 mt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#F1F3F9] tracking-tight">Document Library</h2>
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-[#4A5168]">
                {filteredDocuments.length}{searchQuery ? ` of ${documents.length}` : ''} document{filteredDocuments.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          <WorkspaceInsights documents={documents} />

          <DocumentList
            documents={filteredDocuments}
            workspaceId={workspaceId}
            loading={loadState === 'loading'}
            viewMode={viewMode}
            onDelete={handleDocumentDeleted}
          />
        </section>
      </div>
    </div>
  );
}
