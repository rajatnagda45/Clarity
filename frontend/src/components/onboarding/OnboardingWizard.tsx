'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '@clerk/nextjs';
import { 
  Building2, UploadCloud, FileText, Database, Server, Zap, CheckCircle2,
  ArrowRight, Loader2, X
} from 'lucide-react';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';

type WizardStep = 'workspace' | 'upload' | 'indexing';

export function OnboardingWizard() {
  const { showWizard, markWizardComplete, completeStep } = useOnboarding();
  const { setActiveWorkspace } = useWorkspace();
  const { user } = useUser();
  
  const [step, setStep] = useState<WizardStep>('workspace');
  
  // Workspace Form State
  const [wsName, setWsName] = useState(`${user?.firstName || 'My'} Workspace`);
  const [isCreatingWs, setIsCreatingWs] = useState(false);

  // Upload State
  const [isUploading, setIsUploading] = useState(false);

  // Pipeline State
  const [pipelineStage, setPipelineStage] = useState(0);

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingWs(true);
    
    // Simulate backend creation
    await new Promise(r => setTimeout(r, 1000));
    
    setActiveWorkspace({
      id: 'ws_' + Math.random().toString(36).substr(2, 9),
      name: wsName,
      role: 'owner',
      plan: 'free'
    });
    
    completeStep('create_workspace');
    setIsCreatingWs(false);
    setStep('upload');
  };

  const handleSimulateUpload = async () => {
    setIsUploading(true);
    // Simulate upload time
    await new Promise(r => setTimeout(r, 1500));
    completeStep('upload_document');
    setIsUploading(false);
    setStep('indexing');
  };

  // Pipeline animation effect
  useEffect(() => {
    if (step === 'indexing') {
      const stages = 5;
      let currentStage = 0;
      
      const interval = setInterval(() => {
        currentStage++;
        setPipelineStage(currentStage);
        
        if (currentStage >= stages) {
          clearInterval(interval);
          setTimeout(() => {
            completeStep('watch_indexing');
            markWizardComplete();
          }, 1500);
        }
      }, 1200); // 1.2s per stage for dramatic effect

      return () => clearInterval(interval);
    }
  }, [step, completeStep, markWizardComplete]);

  if (!showWizard) return null;

  const PIPELINE_STAGES = [
    { label: 'Upload', icon: UploadCloud },
    { label: 'Extract', icon: FileText },
    { label: 'Chunk', icon: Server },
    { label: 'Embed', icon: Zap },
    { label: 'Index', icon: Database },
    { label: 'Ready', icon: CheckCircle2 }
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#05070B]/90 backdrop-blur-md">
        
        <button 
          onClick={markWizardComplete}
          className="absolute top-6 right-6 p-2 rounded-full bg-white/[0.04] text-[#8892AA] hover:text-white transition-colors"
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
                  disabled={isCreatingWs || !wsName}
                  className="w-full py-4 rounded-xl font-bold bg-white text-[#05070B] flex items-center justify-center gap-2 hover:bg-white/90 transition-colors disabled:opacity-50"
                >
                  {isCreatingWs ? <Loader2 size={20} className="animate-spin" /> : 'Continue'}
                  {!isCreatingWs && <ArrowRight size={20} />}
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
              <p className="text-[#8892AA] mb-8">Clarity needs knowledge to answer your questions. Let's upload a sample.</p>
              
              <div 
                onClick={handleSimulateUpload}
                className="border-2 border-dashed border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/10 transition-colors rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer mb-6"
              >
                {isUploading ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  >
                    <Loader2 size={48} className="text-purple-400 mb-4" />
                  </motion.div>
                ) : (
                  <motion.div
                    animate={{ y: [0, -10, 0] }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                  >
                    <UploadCloud size={48} className="text-purple-400 mb-4" />
                  </motion.div>
                )}
                
                <h3 className="text-[#F1F3F9] font-semibold text-lg mb-1">
                  {isUploading ? 'Uploading...' : 'Click to select a file'}
                </h3>
                <p className="text-[#4A5168] text-sm text-center">
                  Supports PDF, TXT, MD, DOCX. Max 50MB.
                </p>
              </div>

              <div className="text-center">
                <button 
                  onClick={() => { completeStep('upload_document'); setStep('indexing'); }}
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
                <p className="text-[#8892AA]">Watch how Clarity converts your document into AI-ready vectors.</p>
              </div>

              <div className="relative z-10 flex flex-col gap-4 max-w-sm mx-auto">
                {PIPELINE_STAGES.map((stage, idx) => {
                  const isActive = pipelineStage === idx;
                  const isDone = pipelineStage > idx;
                  const Icon = stage.icon;
                  
                  return (
                    <div key={stage.label} className="flex items-center gap-4 relative">
                      {/* Connecting Line */}
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

                      {isActive && (
                        <Loader2 size={16} className="text-purple-400 animate-spin" />
                      )}
                      {isDone && (
                        <CheckCircle2 size={16} className="text-emerald-400" />
                      )}
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
