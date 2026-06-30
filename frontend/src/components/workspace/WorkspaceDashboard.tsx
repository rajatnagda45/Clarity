'use client';

import { DashboardHero } from '@/components/dashboard/DashboardHero';
import { AnalyticsChart } from '@/components/dashboard/AnalyticsChart';
import { StorageCard } from '@/components/dashboard/StorageCard';
import { RecentDocumentsTable } from '@/components/dashboard/RecentDocumentsTable';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
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
    <div className="mx-auto max-w-[1800px] px-6 py-6 space-y-6">
      <DashboardHero />

      {/* Row 2: Analytics + Storage */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AnalyticsChart data={[]} loading={false} />
        </div>
        <StorageCard
          indexedDocs={devDashboard.data?.statusCounts?.indexed ?? 0}
          totalDocs={documents.length}
          totalChunks={embeddingMetrics.data?.chunksProcessed ?? 0}
          loading={devDashboard.isLoading || embeddingMetrics.isLoading}
        />
      </div>

      {/* Row 3: Recent Docs + Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentDocumentsTable documents={sortedDocs.slice(0, 5)} loading={docsLoading} />
        </div>
        <ActivityFeed
          documents={documents}
          conversations={conversations}
          loading={docsLoading || convsLoading}
        />
      </div>
    </div>
  );
}
