'use client';

import { motion } from 'framer-motion';
import { useUser } from '@clerk/nextjs';
import { FileText, MessageSquare, Building2, CheckCircle2 } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useDocuments } from '@/hooks/useDocuments';
import { useConversations } from '@/hooks/useConversations';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { MetricCard } from './MetricCard';

function formattedDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function DashboardHero() {
  const { user } = useUser();
  const { activeWorkspace, workspaces } = useWorkspace();
  const { data: documents, isLoading: documentsLoading } = useDocuments();
  const { data: conversations, isLoading: conversationsLoading } = useConversations();
  const { devDashboard } = useDashboardMetrics();

  const firstName = user?.firstName ?? 'there';

  const metrics = [
    {
      label: 'Total Documents',
      value: documents?.length ?? null,
      icon: <FileText size={18} />,
      iconBg: 'rgba(91,110,240,0.15)',
      loading: documentsLoading,
    },
    {
      label: 'AI Conversations',
      value: conversations?.length ?? null,
      icon: <MessageSquare size={18} />,
      iconBg: 'rgba(34,197,94,0.15)',
      loading: conversationsLoading,
    },
    {
      label: 'Active Workspaces',
      value: workspaces.length,
      icon: <Building2 size={18} />,
      iconBg: 'rgba(245,158,11,0.15)',
      loading: false,
    },
    {
      label: 'Indexed Docs',
      value: devDashboard.data?.statusCounts?.indexed ?? null,
      icon: <CheckCircle2 size={18} />,
      iconBg: 'rgba(34,197,94,0.15)',
      loading: devDashboard.isLoading,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-[#F1F3F9]">
          Welcome back, {firstName} 👋
        </h1>
        <p className="mt-1 text-sm text-[#8892AA]">
          Here&apos;s what&apos;s happening in{' '}
          {activeWorkspace?.name ?? 'your workspace'}
        </p>
        <p className="mt-0.5 text-xs text-[#4A5168]">{formattedDate()}</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {metrics.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.3 }}
          >
            <MetricCard
              label={m.label}
              value={m.value}
              icon={m.icon}
              iconBg={m.iconBg}
              loading={m.loading}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
