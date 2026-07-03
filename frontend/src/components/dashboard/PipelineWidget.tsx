'use client';

import { motion } from 'framer-motion';
import { UploadCloud, FileSearch, Layers, Cpu, CheckCircle2, AlertCircle } from 'lucide-react';
import type { DeveloperDashboard } from '@/types/clarity';

interface PipelineWidgetProps {
  devDashboard: DeveloperDashboard | null;
  documents: any[];
  loading?: boolean;
}

const STAGES = [
  { id: 'uploaded', label: 'Upload', icon: UploadCloud },
  { id: 'extracting', label: 'Extract', icon: FileSearch },
  { id: 'chunking', label: 'Chunk', icon: Layers },
  { id: 'embedding', label: 'Embed', icon: Cpu },
  { id: 'indexed', label: 'Ready', icon: CheckCircle2 },
];

export function PipelineWidget({ devDashboard, documents, loading = false }: PipelineWidgetProps) {
  const statusCounts = devDashboard?.statusCounts ?? {};
  const failedCount = devDashboard?.failedJobs?.length ?? 0;
  
  // Find a document currently in progress (not indexed and not failed)
  const inProgressDoc = devDashboard?.documents?.find(
    d => d.status !== 'indexed' && d.status !== 'failed' && d.error == null
  );
  
  const currentStageIndex = inProgressDoc 
    ? STAGES.findIndex(s => s.id === inProgressDoc.status)
    : -1;

  const isProcessing = currentStageIndex >= 0 && currentStageIndex < STAGES.length - 1;

  if (loading) {
    return (
      <div className="bg-[#0F1117] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6 h-[200px] animate-pulse">
        <div className="h-6 w-48 bg-white/5 rounded-md mb-8" />
        <div className="flex justify-between items-center px-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="w-12 h-12 rounded-full bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0F1117] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6 shadow-xl relative overflow-hidden">
      {/* Background glow if processing */}
      {isProcessing && (
        <motion.div 
          animate={{ opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute inset-0 bg-gradient-to-r from-orange-500/5 to-purple-500/5 pointer-events-none"
        />
      )}

      <div className="flex items-center justify-between mb-8 relative z-10">
        <h2 className="text-[#F1F3F9] font-bold text-lg tracking-tight flex items-center gap-2">
          Pipeline Monitor
          {isProcessing && (
            <span className="flex h-2 w-2 relative ml-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
            </span>
          )}
        </h2>
        
        {failedCount > 0 && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-red-400 bg-red-400/10 px-2.5 py-1 rounded-full border border-red-400/20">
            <AlertCircle size={12} />
            {failedCount} Failed
          </div>
        )}
      </div>

      <div className="relative flex justify-between items-center px-2 sm:px-6 z-10">
        {/* Connecting Line */}
        <div className="absolute left-[10%] right-[10%] top-1/2 -translate-y-1/2 h-0.5 bg-white/[0.05] -z-10" />
        
        {/* Animated Progress Line */}
        {isProcessing && (
          <motion.div 
            className="absolute left-[10%] top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-orange-500 to-purple-500 -z-10"
            initial={{ width: '0%' }}
            animate={{ width: `${(currentStageIndex / (STAGES.length - 1)) * 80}%` }}
            transition={{ type: 'spring', damping: 20 }}
          />
        )}

        {STAGES.map((stage, i) => {
          const isCurrent = i === currentStageIndex;
          const isPast = isProcessing ? i < currentStageIndex : false;
          const isComplete = !isProcessing && documents.length > 0 && stage.id === 'indexed';

          const Icon = stage.icon;
          
          let stateClass = "border-white/10 text-gray-500 bg-[#0F1117]";
          if (isCurrent) stateClass = "border-orange-500/50 text-orange-400 shadow-[0_0_20px_rgba(245,158,11,0.2)] bg-orange-500/10";
          if (isPast) stateClass = "border-purple-500/50 text-purple-400 bg-purple-500/10";
          if (isComplete) stateClass = "border-green-500/50 text-green-400 shadow-[0_0_20px_rgba(34,197,94,0.1)] bg-green-500/10";

          return (
            <div key={stage.id} className="flex flex-col items-center gap-3">
              <motion.div 
                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 flex items-center justify-center transition-colors duration-500 relative ${stateClass}`}
                animate={isCurrent ? { y: [0, -4, 0] } : { y: 0 }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              >
                <Icon size={18} strokeWidth={isCurrent || isComplete ? 2.5 : 2} />
                
                {/* Ping ring for current stage */}
                {isCurrent && (
                  <span className="absolute inset-0 rounded-full border-2 border-orange-500 animate-[ping_3s_ease-out_infinite] opacity-50" />
                )}
              </motion.div>
              <span className={`text-[10px] sm:text-xs font-medium uppercase tracking-wider ${isCurrent ? 'text-orange-400' : isComplete ? 'text-green-400' : 'text-[#4A5168]'}`}>
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
