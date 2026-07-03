'use client';

import { motion } from 'framer-motion';
import { DashboardHero } from '@/components/dashboard/DashboardHero';
import { AnalyticsChart } from '@/components/dashboard/AnalyticsChart';
import { PipelineWidget } from '@/components/dashboard/PipelineWidget';
import { AIAssistantPanel } from '@/components/dashboard/AIAssistantPanel';
import { RecentDocumentsTable } from '@/components/dashboard/RecentDocumentsTable';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { PremiumBackground } from '@/components/landing/PremiumBackground';
import { useDocuments } from '@/hooks/useDocuments';
import { useConversations } from '@/hooks/useConversations';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';

export function WorkspaceDashboard() {
  const { data: documents = [], isLoading: docsLoading } = useDocuments();
  const { data: conversations = [], isLoading: convsLoading } = useConversations();
  const { devDashboard, embeddingMetrics } = useDashboardMetrics();

  const sortedDocs = [...documents].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div className="relative min-h-screen bg-[#05070B] selection:bg-orange-500/30 selection:text-white">
      {/* Background layer */}
      <PremiumBackground glowOpacity={0.3} />

      <div className="mx-auto max-w-[1600px] px-6 py-8 relative z-10 space-y-8">
        <DashboardHero 
          documents={documents} 
          conversations={conversations} 
          devDashboard={devDashboard}
          docsLoading={docsLoading}
          convsLoading={convsLoading}
        />

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
          {/* LEFT COLUMN: Data & Workflows */}
          <div className="xl:col-span-2 space-y-8">
            <PipelineWidget 
              devDashboard={devDashboard.data ?? null} 
              documents={documents}
              loading={devDashboard.isLoading || docsLoading} 
            />

            <AnalyticsChart data={[]} loading={false} />

            <RecentDocumentsTable 
              documents={sortedDocs.slice(0, 5)} 
              loading={docsLoading} 
            />
          </div>

          {/* RIGHT COLUMN: AI & Activity */}
          <div className="space-y-8">
            <AIAssistantPanel />
            
            <ActivityFeed
              documents={documents}
              conversations={conversations}
              loading={docsLoading || convsLoading}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
