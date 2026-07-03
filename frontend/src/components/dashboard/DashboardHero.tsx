'use client';

import { motion } from 'framer-motion';
import { useUser } from '@clerk/nextjs';
import { FileText, MessageSquare, CheckCircle2, Activity, Zap, HardDrive } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { MetricCard } from './MetricCard';

interface DashboardHeroProps {
  documents: any[];
  conversations: any[];
  devDashboard: any;
  docsLoading: boolean;
  convsLoading: boolean;
}

export function DashboardHero({ 
  documents, 
  conversations, 
  devDashboard, 
  docsLoading, 
  convsLoading 
}: DashboardHeroProps) {
  const { user } = useUser();
  const { activeWorkspace } = useWorkspace();

  const firstName = user?.firstName ?? 'there';
  const numDocs = documents?.length ?? 0;
  const numConvos = conversations?.length ?? 0;
  const numIndexed = devDashboard.data?.statusCounts?.indexed ?? 0;
  const failedJobs = devDashboard.data?.failedJobs?.length ?? 0;
  
  const isHealthy = failedJobs === 0;

  // Smart Narrative Generation
  const generateNarrative = () => {
    if (docsLoading || convsLoading || devDashboard.isLoading) {
      return "Analyzing workspace activity...";
    }
    
    if (numDocs === 0) {
      return `Welcome to your new workspace. Upload your first document to get started.`;
    }

    let narrative = `You have ${numDocs} document${numDocs !== 1 ? 's' : ''} in ${activeWorkspace?.name ?? 'your workspace'}`;
    if (numIndexed > 0) {
      narrative += `, with ${numIndexed} successfully indexed. `;
    } else {
      narrative += `. `;
    }

    if (numConvos > 0) {
      narrative += `${numConvos} conversation${numConvos !== 1 ? 's' : ''} occurred recently. `;
    }

    if (isHealthy) {
      narrative += "Workspace health is optimal.";
    } else {
      narrative += `Warning: ${failedJobs} document${failedJobs !== 1 ? 's' : ''} failed to process.`;
    }

    return narrative;
  };

  const getSuggestedAction = () => {
    if (docsLoading) return null;
    if (numDocs === 0) return { label: "Upload a document", action: "upload" };
    if (numConvos === 0) return { label: "Start your first AI chat", action: "chat" };
    return { label: "Ask AI about your recent uploads", action: "chat" };
  };

  const suggestion = getSuggestedAction();

  const metrics = [
    {
      label: 'Total Documents',
      value: numDocs > 0 ? numDocs : null,
      icon: <FileText size={18} />,
      iconBg: 'rgba(91,110,240,0.1)',
      iconColor: '#5B6EF0',
      loading: docsLoading,
    },
    {
      label: 'AI Conversations',
      value: numConvos > 0 ? numConvos : null,
      icon: <MessageSquare size={18} />,
      iconBg: 'rgba(34,197,94,0.1)',
      iconColor: '#22C55E',
      loading: convsLoading,
    },
    {
      label: 'Indexed Files',
      value: numIndexed > 0 ? numIndexed : null,
      icon: <CheckCircle2 size={18} />,
      iconBg: 'rgba(245,158,11,0.1)',
      iconColor: '#F59E0B',
      loading: devDashboard.isLoading,
    },
    {
      label: 'Storage Health',
      value: isHealthy ? 'Optimal' : 'Issues Detected',
      icon: <HardDrive size={18} />,
      iconBg: isHealthy ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
      iconColor: isHealthy ? '#22C55E' : '#EF4444',
      loading: devDashboard.isLoading,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* Smart AI Header */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-[#0F1117] border border-[rgba(255,255,255,0.08)] p-8 shadow-2xl"
      >
        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-extrabold text-[#F1F3F9] tracking-tight mb-2">
              Good Morning, {firstName} <span className="inline-block origin-[70%_70%] animate-[wave_2s_ease-in-out_infinite]">👋</span>
            </h1>
            <p className="text-[#8892AA] text-lg leading-relaxed">
              {generateNarrative()}
            </p>
          </div>
          
          {suggestion && (
            <div className="shrink-0 bg-white/[0.03] border border-white/[0.08] rounded-xl px-5 py-4 flex flex-col items-start backdrop-blur-sm">
              <span className="text-xs font-semibold text-[#4A5168] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Zap size={12} className="text-orange-500" /> Suggested Action
              </span>
              <button className="text-[#F1F3F9] font-medium hover:text-orange-400 transition-colors flex items-center gap-2 text-sm group">
                {suggestion.label}
                <span className="opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all">→</span>
              </button>
            </div>
          )}
        </div>
        
        {/* Subtle background glow for header */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-orange-500/10 to-purple-600/10 blur-[100px] pointer-events-none rounded-full -translate-y-1/2 translate-x-1/3" />
      </motion.div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.1, duration: 0.4, ease: "easeOut" }}
          >
            <MetricCard
              label={m.label}
              value={m.value}
              icon={m.icon}
              iconBg={m.iconBg}
              iconColor={m.iconColor}
              loading={m.loading}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
