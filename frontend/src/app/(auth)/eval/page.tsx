'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { ProgressBar } from '@/components/ds/Progress';
import { Badge } from '@/components/ds/Badge';
import { Tabs, TabList, Tab, TabPanel } from '@/components/ds/Tabs';
import { Skeleton } from '@/components/ds/Skeleton';
import { EmptyState } from '@/components/ds/EmptyState';
import { getEvalMetrics } from '@/lib/api';
import type { EvalMetrics } from '@/types/clarity';

function MetricRow({ label, value }: { label: string; value: number | undefined | null }) {
  if (value == null) return null;
  const pct = Math.round(value * 100);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-[var(--color-text-secondary)]">{label}</span>
        <span className="text-sm font-semibold tabular-nums text-[var(--color-text-primary)]">{pct}%</span>
      </div>
      <ProgressBar
        value={pct}
        size="md"
        variant={pct >= 80 ? 'success' : pct >= 55 ? 'warning' : 'error'}
      />
    </div>
  );
}

function EvalMetricsCard({ metrics }: { metrics: EvalMetrics }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-5">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-semibold text-[var(--color-text-primary)]">
            {new Date(metrics.createdAt).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
            })}
          </span>
          {metrics.commitSha && (
            <span className="ml-2 font-mono text-xs text-[var(--color-text-tertiary)]">
              {metrics.commitSha.slice(0, 7)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="default" size="sm">{metrics.casesTotal} cases</Badge>
          <Badge variant={metrics.suite === 'golden' ? 'success' : 'warning'} size="sm">
            {metrics.suite}
          </Badge>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <MetricRow label="Faithfulness" value={metrics.faithfulness} />
        <MetricRow label="Relevance" value={metrics.relevance} />
        <MetricRow label="Context Precision" value={metrics.contextPrecision} />
        <MetricRow label="Context Recall" value={metrics.contextRecall} />
        {metrics.catchRate != null && <MetricRow label="Catch Rate" value={metrics.catchRate} />}
        {metrics.calibrationEce != null && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--color-text-secondary)]">Calibration Error (ECE)</span>
            <span className="font-semibold tabular-nums text-[var(--color-text-primary)]">
              {(metrics.calibrationEce * 100).toFixed(1)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function EvalPage() {
  const { getToken } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [golden, setGolden] = useState<EvalMetrics[]>([]);
  const [adversarial, setAdversarial] = useState<EvalMetrics[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeWorkspace) return;
    setLoading(true);
    getToken().then(async (token) => {
      if (!token) return;
      const auth = { token, workspaceId: activeWorkspace.id };
      try {
        const [g, a] = await Promise.allSettled([
          getEvalMetrics(auth, 'golden'),
          getEvalMetrics(auth, 'adversarial'),
        ]);
        if (g.status === 'fulfilled') setGolden(g.value);
        if (a.status === 'fulfilled') setAdversarial(a.value);
      } finally {
        setLoading(false);
      }
    });
  }, [activeWorkspace, getToken]);

  return (
      <div className="mx-auto w-full max-w-3xl px-6 py-8 flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Evaluation Dashboard</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Quality metrics measured against golden and adversarial test suites.
          </p>
        </div>

        <Tabs defaultTab="golden">
          <TabList aria-label="Eval suites">
            <Tab id="golden">Golden suite</Tab>
            <Tab id="adversarial">Adversarial suite</Tab>
          </TabList>

          <TabPanel id="golden">
            <div className="mt-4 flex flex-col gap-4">
              {loading ? (
                Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)
              ) : golden.length === 0 ? (
                <EmptyState title="No golden eval runs" description="Run an evaluation to populate metrics." />
              ) : (
                golden.map((m, i) => <EvalMetricsCard key={i} metrics={m} />)
              )}
            </div>
          </TabPanel>

          <TabPanel id="adversarial">
            <div className="mt-4 flex flex-col gap-4">
              {loading ? (
                Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)
              ) : adversarial.length === 0 ? (
                <EmptyState title="No adversarial eval runs" description="Run an adversarial evaluation to populate metrics." />
              ) : (
                adversarial.map((m, i) => <EvalMetricsCard key={i} metrics={m} />)
              )}
            </div>
          </TabPanel>
        </Tabs>
      </div>
  );
}
