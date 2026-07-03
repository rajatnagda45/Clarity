'use client';

import { motion } from 'framer-motion';
import { Settings2, RotateCcw, AlertTriangle } from 'lucide-react';
import { useOnboarding } from '@/contexts/OnboardingContext';

export function AdvancedSettingsTab() {
  const { restartOnboarding } = useOnboarding();

  return (
    <div className="flex flex-col animate-in fade-in duration-500 max-w-4xl">
      
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#F1F3F9] tracking-tight flex items-center gap-3">
            <Settings2 className="text-purple-400" size={28} />
            Advanced Settings
          </h1>
          <p className="text-[#8892AA] mt-2 text-lg">Developer mode and experimental features.</p>
        </div>
      </div>

      <div className="bg-[#0F1117] border border-white/[0.06] rounded-[24px] p-8 mb-8">
        <h2 className="text-xl font-bold text-[#F1F3F9] mb-2">Onboarding Experience</h2>
        <p className="text-[#8892AA] mb-6">
          Restart the onboarding experience to view the welcome screen, wizard, and pipeline simulation again. This will reset your checklist progress locally.
        </p>
        
        <button
          onClick={restartOnboarding}
          className="flex items-center gap-2 bg-white/[0.04] hover:bg-white/[0.08] text-[#F1F3F9] border border-white/[0.04] px-5 py-2.5 rounded-xl transition-colors font-medium text-sm"
        >
          <RotateCcw size={16} />
          Restart Onboarding
        </button>
      </div>

      <div className="bg-rose-500/10 border border-rose-500/20 rounded-[24px] p-8">
        <h2 className="text-xl font-bold text-rose-400 mb-2 flex items-center gap-2">
          <AlertTriangle size={20} />
          Danger Zone
        </h2>
        <p className="text-[#8892AA] mb-6">
          Irreversible actions that will permanently delete data across your workspace.
        </p>
        
        <button
          className="flex items-center gap-2 bg-rose-500 hover:bg-rose-600 text-white px-5 py-2.5 rounded-xl transition-colors font-medium text-sm"
        >
          Delete Workspace
        </button>
      </div>

    </div>
  );
}
