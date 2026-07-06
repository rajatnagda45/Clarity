'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, MessageSquare, UploadCloud, Users, BarChart2 } from 'lucide-react';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export function CompletionCelebration() {
  const { state, dismissCelebration } = useOnboarding();
  const { activeWorkspace } = useWorkspace();

  const allStepsComplete = Object.values(state.completedSteps).every(Boolean);
  const isVisible = allStepsComplete && state.isWizardComplete && !state.celebrationDismissed;

  if (!isVisible) return null;

  const ACTIONS = [
    { label: 'Ask another question', icon: MessageSquare, color: 'text-purple-400' },
    { label: 'Upload more documents', icon: UploadCloud, color: 'text-blue-400' },
    { label: 'Invite teammates', icon: Users, color: 'text-emerald-400' },
    { label: 'Explore Analytics', icon: BarChart2, color: 'text-amber-400' },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#05070B]/95 backdrop-blur-sm overflow-hidden">
        
        {/* Subtle Confetti / Glow Effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div 
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.5, type: 'spring' }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[radial-gradient(ellipse_at_center,rgba(168,85,247,0.15)_0%,transparent_70%)] blur-[100px]" 
          />
        </div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, type: 'spring', bounce: 0.3 }}
          className="relative z-10 w-full max-w-2xl bg-[#0F1117] border border-white/[0.08] rounded-[32px] p-10 md:p-12 shadow-2xl text-center mx-4"
        >
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 mx-auto flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(52,211,153,0.4)] relative">
            <Sparkles size={32} className="text-white" />
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              className="absolute inset-[-4px] rounded-[24px] border border-emerald-400/[0.4] border-dashed"
            />
          </div>

          <h2 className="text-3xl md:text-4xl font-bold text-[#F1F3F9] mb-4">
            Congratulations!
          </h2>
          <p className="text-[#8892AA] text-lg mb-8 max-w-md mx-auto">
            You&apos;ve successfully set up <strong className="text-[#F1F3F9] font-semibold">{activeWorkspace?.name || 'your workspace'}</strong>. Your AI is now fully configured and ready to assist your team.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10 text-left">
            {ACTIONS.map((action, idx) => (
              <motion.button
                key={action.label}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + idx * 0.1 }}
                onClick={() => dismissCelebration()}
                className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.1] transition-all group"
              >
                <div className={`w-10 h-10 rounded-xl bg-white/[0.02] flex items-center justify-center ${action.color}`}>
                  <action.icon size={18} />
                </div>
                <span className="font-semibold text-[#F1F3F9] text-sm group-hover:text-purple-400 transition-colors">
                  {action.label}
                </span>
              </motion.button>
            ))}
          </div>

          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            onClick={() => dismissCelebration()}
            className="group inline-flex items-center gap-2 bg-white text-[#05070B] px-8 py-3.5 rounded-xl font-bold hover:bg-white/90 transition-colors"
          >
            Go to Dashboard
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </motion.button>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
