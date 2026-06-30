'use client';

import { useDashboardData } from '@/components/dashboard/useDashboardData';
import { DashboardHero } from '@/components/dashboard/DashboardHero';
import { WorkspaceOverview } from '@/components/dashboard/WorkspaceOverview';
import { QuickActionsWidget } from '@/components/dashboard/QuickActionsWidget';
import { PipelineWidget } from '@/components/dashboard/PipelineWidget';
import { RecentDocumentsWidget } from '@/components/dashboard/RecentDocumentsWidget';
import { RecentConversationsWidget } from '@/components/dashboard/RecentConversationsWidget';
import { QualityWidget } from '@/components/dashboard/QualityWidget';
import { ActivityWidget } from '@/components/dashboard/ActivityWidget';
import { UsageWidget } from '@/components/dashboard/UsageWidget';
import { Button } from '@/components/ds/Button';

export function WorkspaceDashboard() {
  const { data, isLoading, refresh } = useDashboardData();

  return (
    <div className="flex flex-col gap-6 px-6 py-6 max-w-[1280px] mx-auto w-full">
      {/* Hero: greeting + top stats */}
      <DashboardHero data={data} loading={isLoading} />

      {/* Row 1: Quick Actions + Workspace Overview */}
      <div className="grid gap-4 lg:grid-cols-[1fr_1.6fr]">
        <QuickActionsWidget />
        <WorkspaceOverview data={data} loading={isLoading} />
      </div>

      {/* Row 2: Pipeline health (full width) */}
      <PipelineWidget
        devDashboard={data.devDashboard}
        documents={data.documents}
        loading={isLoading}
      />

      {/* Row 3: Recent docs + Recent conversations */}
      <div className="grid gap-4 lg:grid-cols-2">
        <RecentDocumentsWidget documents={data.documents} loading={isLoading} />
        <RecentConversationsWidget conversations={data.conversations} loading={isLoading} />
      </div>

      {/* Row 4: Quality + Activity */}
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <QualityWidget
          evalMetrics={data.evalMetrics}
          answerMetrics={data.answerMetrics}
          loading={isLoading}
        />
        <ActivityWidget
          documents={data.documents}
          conversations={data.conversations}
          loading={isLoading}
        />
      </div>

      {/* Row 5: Usage */}
      <UsageWidget
        answerMetrics={data.answerMetrics}
        embeddingMetrics={data.embeddingMetrics}
        loading={isLoading}
      />

      {/* Refresh */}
      <div className="flex items-center justify-center pt-2 pb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={refresh}
          icon={
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
              <path d="M12 7A5 5 0 1 1 7 2v2l3-3-3-3v2a7 7 0 1 0 7 7h-2z" />
            </svg>
          }
        >
          Refresh dashboard
        </Button>
      </div>
    </div>
  );
}
