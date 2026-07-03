'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { useOnboarding } from '@/contexts/OnboardingContext';

const CHECKLIST_STEPS = [
  { id: 'create_workspace', label: 'Create a Workspace' },
  { id: 'upload_document', label: 'Upload First Document' },
  { id: 'watch_indexing', label: 'Wait for Indexing' },
  { id: 'ask_ai', label: 'Ask AI a Question' },
  { id: 'view_citations', label: 'View Citations' },
  { id: 'invite_team', label: 'Invite Teammates' },
] as const;

export function OnboardingChecklist() {
  const { state, showChecklist, completeStep } = useOnboarding();
  const [isExpanded, setIsExpanded] = useState(true);

  if (!showChecklist) return null;

  const completedCount = Object.values(state.completedSteps).filter(Boolean).length;
  const totalCount = CHECKLIST_STEPS.length;
  const progressPct = Math.round((completedCount / totalCount) * 100);

  return (
    <div className="fixed bottom-6 right-6 z-40">
      <AnimatePresence mode="wait">
        {isExpanded ? (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', bounce: 0.2 }}
            className="w-80 bg-[#0F1117] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div 
              onClick={() => setIsExpanded(false)}
              className="px-5 py-4 bg-white/[0.02] border-b border-white/[0.04] flex items-center justify-between cursor-pointer hover:bg-white/[0.04] transition-colors"
            >
              <div>
                <h3 className="text-[#F1F3F9] font-bold text-sm">Getting Started</h3>
                <p className="text-xs text-[#8892AA]">{completedCount} of {totalCount} complete</p>
              </div>
              <ChevronDown size={16} className="text-[#4A5168]" />
            </div>

            {/* Progress Bar */}
            <div className="h-1 w-full bg-[#05070B]">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                className="h-full bg-gradient-to-r from-purple-500 to-blue-500"
              />
            </div>

            {/* Tasks */}
            <div className="p-2">
              {CHECKLIST_STEPS.map((step, idx) => {
                const isComplete = state.completedSteps[step.id];
                return (
                  <motion.div
                    key={step.id}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => {
                      if (!isComplete) completeStep(step.id);
                    }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.02] transition-colors group cursor-pointer"
                  >
                    <div className="shrink-0 mt-0.5">
                      {isComplete ? (
                        <CheckCircle2 size={18} className="text-emerald-400" />
                      ) : (
                        <Circle size={18} className="text-[#4A5168] group-hover:text-[#8892AA] transition-colors" />
                      )}
                    </div>
                    <span className={`text-sm ${isComplete ? 'text-[#8892AA] line-through decoration-[#4A5168]' : 'text-[#F1F3F9]'} transition-all`}>
                      {step.label}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        ) : (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsExpanded(true)}
            className="flex items-center gap-2 bg-[#0F1117] border border-white/[0.1] shadow-xl px-4 py-3 rounded-full"
          >
            <Sparkles size={16} className="text-purple-400" />
            <span className="text-sm font-semibold text-[#F1F3F9]">{progressPct}% Complete</span>
            <ChevronUp size={16} className="text-[#4A5168] ml-2" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
