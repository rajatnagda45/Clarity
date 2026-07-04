'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth, useUser } from '@clerk/nextjs';
import {
  Building2, UploadCloud, FileText, Database, Server, Zap, CheckCircle2,
  ArrowRight, Loader2, X, AlertCircle
} from 'lucide-react';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { createWorkspace, uploadDocument, getDocument } from '@/lib/api';
import type { Document } from '@/types/clarity';

type WizardStep = 'workspace' | 'upload' | 'indexing';

const STAGE_STATUSES: Record<string, number> = {
  uploaded: 0,
  extracted: 1,
  normalized: 1,
  metadata_ready: 1,
  awaiting_chunking: 2,
  chunking: 2,
  chunked: 2,
  awaiting_embeddings: 3,
  embedding: 3,
  embedded: 3,
  awaiting_index: 4,
  indexing: 4,
  indexed: 5,
  failed: -1,
};

const PIPELINE_STAGES = [
  { label: 'Upload', icon: UploadCloud },
  { label: 'Extract', icon: FileText },
  { label: 'Chunk', icon: Server },
  { label: 'Embed', icon: Zap },
  { label: 'Index', icon: Database },
  { label: 'Ready', icon: CheckCircle2 },
];

export function OnboardingWizard() {
  const { showWizard, markWizardComplete, completeStep } = useOnboarding();
  const { setActiveWorkspace, refresh } = useWorkspace();
  const { user } = useUser();
  const { getToken } = useAuth();

  const [step, setStep] = useState<WizardStep>('workspace');
  const [wsName, setWsName] = useState(`${user?.firstName || 'My'} Workspace`);
  const [isCreatingWs, setIsCreatingWs] = useState(false);
  const [wsError, setWsError] = useState('');
  const [createdWorkspaceId, setCreatedWorkspaceId] = useState('');

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadedDoc, setUploadedDoc] = useState<Document | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pipelineStage, setPipelineStage] = useState(0);
  const [indexingFailed, setIndexingFailed] = useState(false);

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingWs(true);
    setWsError('');
    try {
      const token = await getToken();
      if (!token) throw new Error('Session unavailable. Please refresh.');
      const ws = await createWorkspace({ token }, { name: wsName.trim() });
      setCreatedWorkspaceId(ws.id);
      setActiveWorkspace(ws);
      await refresh();
      completeStep('create_workspace');
      setStep('upload');
    } catch (err) {
      setWsError(err instanceof Error ? err.message : 'Failed to create workspace.');
    } finally {
      setIsCreatingWs(false);
    }
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    if (file.size > 50 * 1024 * 1024) {
      setUploadError('File exceeds the 50 MB limit.');
      return;
    }

    setIsUploading(true);
    setUploadError('');
    try {
      const token = await getToken();
      if (!token) throw new Error('Session unavailable. Please refresh.');
      const workspaceId = createdWorkspaceId;
      const doc = await uploadDocument({ token, workspaceId }, file);
      setUploadedDoc(doc);
      completeStep('upload_document');
      setStep('indexing');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  // Poll document status during indexing step
  useEffect(() => {
    if (step !== 'indexing' || !uploadedDoc) return;

    let cancelled = false;

    async function pollStatus() {
      if (cancelled || !uploadedDoc) return;
      try {
        const token = await getToken();
        if (!token || cancelled) return;
        const doc = await getDocument({ token, workspaceId: createdWorkspaceId }, uploadedDoc.id);
        if (cancelled) return;

        const stageIndex = STAGE_STATUSES[doc.status] ?? 0;

        if (doc.status === 'failed') {
          setIndexingFailed(true);
          setPipelineStage(5);
          completeStep('watch_indexing');
          markWizardComplete();
          return;
        }

        setPipelineStage(Math.max(stageIndex, 1));

        if (doc.status === 'indexed') {
          setPipelineStage(5);
          setTimeout(() => {
            if (!cancelled) {
              completeStep('watch_indexing');
              markWizardComplete();
            }
          }, 1500);
          return;
        }

        setTimeout(pollStatus, 2000);
      } catch {
        if (!cancelled) setTimeout(pollStatus, 3000);
      }
    }

    void pollStatus();
    return () => { cancelled = true; };
  }, [step, uploadedDoc, createdWorkspaceId, getToken, completeStep, markWizardComplete]);

  if (!showWizard) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#05070B]/90 backdrop-blur-md">

        <button
          onClick={markWizardComplete}
          className="absolute top-6 right-6 p-2 rounded-full bg-white/[0.04] text-[#8892AA] hover:text-white transition-colors"
          aria-label="Close onboarding"
        >
          <X size={20} />
        </button>

        <motion.div
          key={step}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          transition={{ duration: 0.4, type: 'spring' }}
          className="relative w-full max-w-xl bg-[#0F1117] border border-white/[0.08] rounded-[32px] shadow-2xl overflow-hidden"
        >

          {/* Step 1: Workspace */}
          {step === 'workspace' && (
            <div className="p-10">
              <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6">
                <Building2 size={32} className="text-blue-400" />
              </div>
              <h2 className="text-3xl font-bold text-[#F1F3F9] mb-2">Create your workspace</h2>
              <p className="text-[#8892AA] mb-8">This is where your documents, collections, and AI agents will live.</p>

              {wsError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 mb-6 text-sm text-red-400">
                  <AlertCircle size={16} className="shrink-0" /> {wsError}
                </div>
              )}

              <form onSubmit={handleCreateWorkspace}>
                <div className="mb-8">
                  <label className="block text-sm font-medium text-[#4A5168] mb-2">Workspace Name</label>
                  <input
                    type="text"
                    value={wsName}
                    onChange={(e) => setWsName(e.target.value)}
                    required
                    className="w-full bg-[#05070B] border border-white/[0.1] rounded-xl px-4 py-3 text-[#F1F3F9] focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isCreatingWs || !wsName.trim()}
                  className="w-full py-4 rounded-xl font-bold bg-white text-[#05070B] flex items-center justify-center gap-2 hover:bg-white/90 transition-colors disabled:opacity-50"
                >
                  {isCreatingWs ? <Loader2 size={20} className="animate-spin" /> : <>Continue <ArrowRight size={20} /></>}
                </button>
              </form>
            </div>
          )}

          {/* Step 2: Upload */}
          {step === 'upload' && (
            <div className="p-10">
              <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-6">
                <UploadCloud size={32} className="text-purple-400" />
              </div>
              <h2 className="text-3xl font-bold text-[#F1F3F9] mb-2">Add your first document</h2>
              <p className="text-[#8892AA] mb-8">Clarity needs knowledge to answer your questions.</p>

              {uploadError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 mb-6 text-sm text-red-400">
                  <AlertCircle size={16} className="shrink-0" /> {uploadError}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx"
                className="hidden"
                onChange={(e) => void handleFileSelect(e.target.files)}
              />

              <div
                onClick={() => !isUploading && fileInputRef.current?.click()}
                className="border-2 border-dashed border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/10 transition-colors rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer mb-6"
              >
                {isUploading ? (
                  <Loader2 size={48} className="text-purple-400 mb-4 animate-spin" />
                ) : (
                  <motion.div
                    animate={{ y: [0, -10, 0] }}
                    transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                  >
                    <UploadCloud size={48} className="text-purple-400 mb-4" />
                  </motion.div>
                )}
                <h3 className="text-[#F1F3F9] font-semibold text-lg mb-1">
                  {isUploading ? 'Uploading...' : 'Click to select a file'}
                </h3>
                <p className="text-[#4A5168] text-sm text-center">Supports PDF, DOCX. Max 50MB.</p>
              </div>

              <div className="text-center">
                <button
                  onClick={() => { completeStep('upload_document'); markWizardComplete(); }}
                  className="text-sm text-[#4A5168] hover:text-[#8892AA] transition-colors"
                >
                  Skip for now
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Indexing Pipeline */}
          {step === 'indexing' && (
            <div className="p-10 relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.1)_0%,transparent_70%)] pointer-events-none" />

              <div className="relative z-10 text-center mb-12">
                <h2 className="text-3xl font-bold text-[#F1F3F9] mb-2">Processing Knowledge</h2>
                <p className="text-[#8892AA]">
                  {indexingFailed
                    ? 'Indexing encountered an error. You can retry from Documents.'
                    : 'Watch Clarity convert your document into AI-ready vectors.'}
                </p>
              </div>

              <div className="relative z-10 flex flex-col gap-4 max-w-sm mx-auto">
                {PIPELINE_STAGES.map((stage, idx) => {
                  const isActive = pipelineStage === idx;
                  const isDone = pipelineStage > idx;
                  const Icon = stage.icon;

                  return (
                    <div key={stage.label} className="flex items-center gap-4 relative">
                      {idx !== PIPELINE_STAGES.length - 1 && (
                        <div className="absolute left-6 top-10 w-0.5 h-6 bg-white/[0.04] -z-10">
                          {isDone && (
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: '100%' }}
                              className="w-full bg-emerald-500"
                            />
                          )}
                        </div>
                      )}

                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all duration-500 ${
                        isDone ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                        isActive ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.4)]' :
                        'bg-white/[0.02] text-[#4A5168] border border-white/[0.04]'
                      }`}>
                        <Icon size={20} className={isActive ? 'animate-pulse' : ''} />
                      </div>

                      <div className="flex-1">
                        <span className={`font-semibold transition-colors duration-500 ${
                          isDone ? 'text-emerald-400' :
                          isActive ? 'text-[#F1F3F9]' :
                          'text-[#4A5168]'
                        }`}>
                          {stage.label}
                        </span>
                      </div>

                      {isActive && <Loader2 size={16} className="text-purple-400 animate-spin" />}
                      {isDone && <CheckCircle2 size={16} className="text-emerald-400" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
