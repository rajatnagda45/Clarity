'use client';

import { motion } from 'framer-motion';
import { Database, FileText, CheckCircle2, AlertCircle, Activity } from 'lucide-react';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import type { Document } from '@/types/clarity';

interface WorkspaceInsightsProps {
  documents: Document[];
}

export function WorkspaceInsights({ documents }: WorkspaceInsightsProps) {
  const { devDashboard, embeddingMetrics, answerMetrics } = useDashboardMetrics();

  const indexedCount = devDashboard.data?.statusCounts?.indexed ?? 0;
  const failedCount = devDashboard.data?.failedJobs?.length ?? 0;
  const processingCount = documents.filter(d => !['indexed', 'failed'].includes(d.status)).length;
  
  const chunksProcessed = embeddingMetrics.data?.chunksProcessed ?? 0;
  const conversations = answerMetrics.data?.conversationsCreated ?? 0;

  const insights = [
    {
      label: 'Indexed Docs',
      value: indexedCount,
      icon: <CheckCircle2 size={16} />,
      color: 'text-green-400',
      bg: 'bg-green-500/10'
    },
    {
      label: 'Processing Queue',
      value: processingCount,
      icon: <Activity size={16} />,
      color: processingCount > 0 ? 'text-orange-400' : 'text-[#8892AA]',
      bg: processingCount > 0 ? 'bg-orange-500/10' : 'bg-white/5'
    },
    {
      label: 'Vector Chunks',
      value: chunksProcessed.toLocaleString(),
      icon: <Database size={16} />,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10'
    },
    {
      label: 'Failed Jobs',
      value: failedCount,
      icon: <AlertCircle size={16} />,
      color: failedCount > 0 ? 'text-red-400' : 'text-[#8892AA]',
      bg: failedCount > 0 ? 'bg-red-500/10' : 'bg-white/5'
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      {insights.map((insight, i) => (
        <motion.div
          key={insight.label}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1, duration: 0.3 }}
          className="bg-[#0F1117] border border-white/[0.04] rounded-2xl p-4 flex items-center gap-4 hover:border-white/[0.08] transition-colors"
        >
          <div className={`p-2.5 rounded-xl ${insight.bg} ${insight.color}`}>
            {insight.icon}
          </div>
          <div>
            <p className="text-xs font-medium text-[#8892AA]">{insight.label}</p>
            <p className="text-lg font-bold text-[#F1F3F9] mt-0.5">{insight.value}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
