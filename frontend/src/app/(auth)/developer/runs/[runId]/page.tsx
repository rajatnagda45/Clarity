'use client';

import { use } from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { AgentGraphViewer } from '@/components/developer/AgentGraphViewer';
import { AgentToolTimeline } from '@/components/developer/AgentToolTimeline';
import { AgentMemoryInspector } from '@/components/developer/AgentMemoryInspector';
import { PremiumBackground } from '@/components/landing/PremiumBackground';

export default function AgentRunDetailPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = use(params);
  return (
    <div className="relative min-h-screen px-6 py-8">
      <PremiumBackground />
      <div className="relative mx-auto max-w-7xl space-y-6">
        <Link
          href="/developer"
          className="inline-flex items-center gap-1 text-xs text-fg-muted transition-colors hover:text-fg-primary"
        >
          <ArrowLeft className="h-3 w-3" /> Developer console
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-fg-primary">Agent run</h1>
          <p className="mt-1 font-mono text-xs text-fg-muted">{runId}</p>
        </div>
        <AgentGraphViewer runId={runId} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <AgentToolTimeline runId={runId} />
          <AgentMemoryInspector runId={runId} />
        </div>
      </div>
    </div>
  );
}
