'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '@clerk/nextjs';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useOnboarding } from '@/contexts/OnboardingContext';

export function OnboardingWelcome() {
  const { showWelcome, markWelcomeSeen } = useOnboarding();
  const { user } = useUser();

  if (!showWelcome) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, filter: 'blur(10px)' }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-[#05070B] overflow-hidden"
      >
        {/* Background Effects */}
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[radial-gradient(ellipse_at_center,rgba(168,85,247,0.15)_0%,transparent_70%)] pointer-events-none blur-[100px]" />
        
        <div className="relative z-10 flex flex-col items-center text-center max-w-2xl px-6">
          
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, type: "spring" }}
            className="w-24 h-24 rounded-[32px] bg-gradient-to-br from-[#5B6EF0] to-[#8B5CF6] flex items-center justify-center mb-8 shadow-[0_0_80px_rgba(91,110,240,0.4)] relative"
          >
            <svg width="48" height="48" viewBox="0 0 16 16" fill="white">
              <path d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z" />
            </svg>
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="absolute inset-[-4px] rounded-[36px] border border-white/[0.2] border-dashed"
            />
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-4xl md:text-6xl font-bold text-[#F1F3F9] tracking-tight mb-4"
          >
            Welcome to Clarity, {user?.firstName || 'Explorer'}
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="text-[#8892AA] text-lg md:text-xl mb-12 max-w-lg leading-relaxed"
          >
            Your AI workspace for trusted document intelligence. Let&apos;s set up your environment in just a few steps.
          </motion.p>

          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={markWelcomeSeen}
            className="group relative flex items-center gap-3 bg-white text-[#05070B] px-8 py-4 rounded-2xl font-bold text-lg shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:shadow-[0_0_60px_rgba(255,255,255,0.4)] transition-all"
          >
            <Sparkles size={20} className="text-[#5B6EF0]" />
            Get Started
            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </motion.button>
          
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.2 }}
            onClick={() => {
              // Quick exit if they don't want onboarding
              markWelcomeSeen();
              const { markWizardComplete } = require('@/contexts/OnboardingContext');
              // We'd ideally call this from context but we just let them enter the wizard and skip there if needed,
              // or handle it properly here. Actually let's just let them skip everything.
              // We will just let them click get started, and skip inside wizard if they want.
            }}
            className="mt-8 text-sm text-[#4A5168] hover:text-[#8892AA] transition-colors"
          >
            Press enter to begin
          </motion.button>

        </div>
      </motion.div>
    </AnimatePresence>
  );
}
