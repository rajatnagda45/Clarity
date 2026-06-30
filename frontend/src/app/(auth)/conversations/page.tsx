'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { AppShell } from '@/components/shell/AppShell';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Skeleton } from '@/components/ds/Skeleton';
import { EmptyState } from '@/components/ds/EmptyState';
import { Badge } from '@/components/ds/Badge';
import { listConversations } from '@/lib/api';
import type { Conversation } from '@/types/clarity';

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function ConversationsPage() {
  const { getToken } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeWorkspace) return;
    setLoading(true);
    getToken().then(async (token) => {
      if (!token) return;
      try {
        const data = await listConversations({ token, workspaceId: activeWorkspace.id });
        setConversations(data.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()));
      } finally {
        setLoading(false);
      }
    });
  }, [activeWorkspace, getToken]);

  return (
    <AppShell breadcrumbs={[{ label: 'Conversations' }]}>
      <div className="mx-auto w-full max-w-3xl px-6 py-8 flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Conversations</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Verified question-answer sessions across your documents.
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-2xl" />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <EmptyState
            title="No conversations yet"
            description="Start a conversation by asking a question about your contracts."
            action={
              <Link
                href="/chat"
                className="inline-flex rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)] transition-colors"
              >
                Start conversation
              </Link>
            }
          />
        ) : (
          <div className="flex flex-col gap-2">
            {conversations.map((conv) => (
              <Link
                key={conv.id}
                href={`/chat?conversation=${conv.id}`}
                className="group flex items-center gap-4 rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] px-4 py-3.5 transition-all hover:border-[var(--color-border-default)] hover:shadow-sm"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent-subtle)] text-[var(--color-accent)]">
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor">
                    <path d="M15 2H0v9a1 1 0 0 0 1 1h2v3l4.5-3H15a1 1 0 0 0 1-1V2z" />
                  </svg>
                </div>
                <div className="flex flex-1 min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm font-medium text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors">
                    {conv.title ?? 'Untitled conversation'}
                  </span>
                  <span className="text-xs text-[var(--color-text-tertiary)]">
                    {formatRelativeTime(conv.lastMessageAt)}
                  </span>
                </div>
                <Badge variant="default" size="sm">
                  {conv.messageCount} msg{conv.messageCount !== 1 ? 's' : ''}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
