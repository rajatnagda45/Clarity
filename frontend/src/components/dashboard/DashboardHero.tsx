'use client';

import { useUser } from '@clerk/nextjs';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { StatCard } from './StatCard';
import type { DashboardData } from './useDashboardData';

interface DashboardHeroProps {
  data: DashboardData;
  loading?: boolean;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardHero({ data, loading = false }: DashboardHeroProps) {
  const { user } = useUser();
  const { activeWorkspace } = useWorkspace();

  const totalDocs = data.documents.length;
  const indexedDocs = data.devDashboard?.statusCounts?.indexed ?? 0;
  const healthPct = totalDocs > 0 ? Math.round((indexedDocs / totalDocs) * 100) : null;
  const faithfulness = data.evalMetrics?.faithfulness ?? null;
  const avgLatencyMs = data.answerMetrics?.answerLatencyMs ?? null;

  const name = user?.firstName ?? user?.fullName ?? null;

  return (
    <div className="flex flex-col gap-6">
      {/* Greeting */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-tertiary)]">
            {activeWorkspace?.name ?? 'Workspace'}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
            {greeting()}{name ? `, ${name}` : ''}.
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
      </div>

      {/* Top-level stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Documents"
          value={totalDocs}
          loading={loading}
          color="accent"
          icon={<DocIcon />}
        />
        <StatCard
          label="Conversations"
          value={data.conversations.length}
          loading={loading}
          color="default"
          icon={<ChatIcon />}
        />
        <StatCard
          label="Pipeline health"
          value={healthPct !== null ? healthPct : '—'}
          suffix={healthPct !== null ? '%' : undefined}
          loading={loading}
          color={
            healthPct === null
              ? 'default'
              : healthPct >= 80
                ? 'success'
                : healthPct >= 40
                  ? 'warning'
                  : 'error'
          }
          icon={<PipelineIcon />}
        />
        <StatCard
          label="Faithfulness"
          value={faithfulness !== null ? Math.round(faithfulness * 100) : '—'}
          suffix={faithfulness !== null ? '%' : undefined}
          loading={loading}
          color={
            faithfulness === null
              ? 'default'
              : faithfulness >= 0.8
                ? 'success'
                : faithfulness >= 0.55
                  ? 'warning'
                  : 'error'
          }
          icon={<TrustIcon />}
        />
      </div>
    </div>
  );
}

function DocIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M4 1h5.586L13 4.414V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zm5 0v4h4l-4-4zM5 7h6v1.5H5V7zm0 3h6v1.5H5V10zm0 3h4v1.5H5V13z" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M14 2H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h2v3l4-3h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z" />
    </svg>
  );
}

function PipelineIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M2 10l3-3 3 3 3-6 3 3v3H2v-1z" />
    </svg>
  );
}

function TrustIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1l2.245 4.552L15 6.382l-3.5 3.411.826 4.817L8 12.2l-4.326 2.41.826-4.817L1 6.382l4.755-.83L8 1z" />
    </svg>
  );
}
