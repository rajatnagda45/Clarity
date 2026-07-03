'use client';

import { motion } from 'framer-motion';
import { 
  CheckCircle2, Circle, Rocket, Building2, Upload, MessageSquare, 
  Grid3X3, Users, CreditCard, UserCircle
} from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';

export function GettingStartedTab() {
  const { activeWorkspace } = useWorkspace();
  const { devDashboard, answerMetrics } = useDashboardMetrics();

  // Determine completion status based on actual app state
  const hasWorkspace = !!activeWorkspace;
  const hasDocuments = (devDashboard.data?.documents?.length || 0) > 0;
  const hasQueries = (answerMetrics.data?.conversationsCreated || 0) > 0;
  // Fallbacks for un-trackable states right now
  const hasCollection = false;
  const hasTeam = false;
  const hasBilling = activeWorkspace?.plan !== 'free';
  const hasProfile = true; // Assuming they signed in

  const steps = [
    { id: 'workspace', title: 'Create a Workspace', desc: 'Set up your first environment for documents and AI agents.', icon: Building2, completed: hasWorkspace },
    { id: 'upload', title: 'Upload your first Document', desc: 'Add PDFs, text, or sync from Notion to start building your knowledge base.', icon: Upload, completed: hasDocuments },
    { id: 'chat', title: 'Ask AI a question', desc: 'Interact with your uploaded knowledge using our powerful chat interface.', icon: MessageSquare, completed: hasQueries },
    { id: 'collection', title: 'Create a Collection', desc: 'Organize related documents together for specific AI agents to use.', icon: Grid3X3, completed: hasCollection },
    { id: 'team', title: 'Invite your Team', desc: 'Collaborate with your coworkers by inviting them to your workspace.', icon: Users, completed: hasTeam },
    { id: 'billing', title: 'Set up Billing', desc: 'Upgrade your plan to unlock higher limits and premium features.', icon: CreditCard, completed: hasBilling },
    { id: 'profile', title: 'Complete your Profile', desc: 'Add your name, avatar, and professional details.', icon: UserCircle, completed: hasProfile },
  ];

  const completedCount = steps.filter(s => s.completed).length;
  const progressPct = Math.round((completedCount / steps.length) * 100);

  return (
    <div className="flex flex-col animate-in fade-in duration-500 max-w-4xl">
      
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#F1F3F9] tracking-tight flex items-center gap-3">
            <Rocket className="text-purple-400" size={28} />
            Getting Started
          </h1>
          <p className="text-[#8892AA] mt-2 text-lg">Follow these steps to master Clarity and set up your workspace.</p>
        </div>
      </div>

      <div className="bg-[#0F1117] border border-white/[0.06] rounded-[24px] p-8 mb-8 relative overflow-hidden">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-[#F1F3F9] font-bold text-xl">Your Progress</h2>
            <p className="text-[#8892AA] text-sm mt-1">{completedCount} of {steps.length} steps completed</p>
          </div>
          <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
            {progressPct}%
          </div>
        </div>
        
        <div className="h-2 w-full bg-[#05070B] rounded-full overflow-hidden border border-white/[0.04]">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {steps.map((step, i) => (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.05 }}
            className={`group flex items-start gap-4 p-5 rounded-[20px] border transition-all ${
              step.completed 
                ? 'bg-white/[0.02] border-white/[0.04] opacity-70' 
                : 'bg-[#0F1117] border-white/[0.08] hover:border-purple-500/30 shadow-sm'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {step.completed ? (
                <CheckCircle2 size={24} className="text-emerald-400" />
              ) : (
                <Circle size={24} className="text-[#4A5168] group-hover:text-purple-400 transition-colors" />
              )}
            </div>
            
            <div className="flex-1">
              <h3 className={`font-semibold mb-1 flex items-center gap-2 ${step.completed ? 'text-[#8892AA] line-through decoration-[#4A5168]' : 'text-[#F1F3F9]'}`}>
                {step.title}
              </h3>
              <p className="text-[#8892AA] text-sm leading-relaxed max-w-2xl">{step.desc}</p>
            </div>
            
            {!step.completed && (
              <button className="px-4 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-sm font-medium text-[#F1F3F9] transition-colors border border-white/[0.04]">
                Start
              </button>
            )}
          </motion.div>
        ))}
      </div>

    </div>
  );
}
