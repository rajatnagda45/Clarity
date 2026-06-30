'use client';

import Link from 'next/link';
import { SkeletonText } from '@/components/ds/Skeleton';
import { EmptyState } from '@/components/ds/EmptyState';
import type { Conversation } from '@/types/clarity';

interface RecentConversationsWidgetProps {
  conversations: Conversation[];
  loading?: boolean;
}

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

export function RecentConversationsWidget({ conversations, loading = false }: RecentConversationsWidgetProps) {
  const recent = conversations
    .slice()
    .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())
    .slice(0, 6);

  return (
    <div className="flex flex-col rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Recent Conversations</h3>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            {conversations.length} total
          </p>
        </div>
        <Link
          href="/conversations"
          className="text-xs font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors"
        >
          View all →
        </Link>
      </div>

      {/* List */}
      <div className="flex flex-col divide-y divide-[var(--color-border-subtle)]">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3">
              <div className="h-7 w-7 shrink-0 rounded-lg bg-[var(--color-bg-elevated)]" />
              <div className="flex flex-1 flex-col gap-1.5">
                <SkeletonText lines={1} />
              </div>
            </div>
          ))
        ) : recent.length === 0 ? (
          <div className="px-5 py-8">
            <EmptyState
              icon={<ChatEmptyIcon />}
              title="No conversations yet"
              description="Ask your first question about a contract."
              action={
                <Link
                  href="/conversations"
                  className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-accent-hover)] transition-colors"
                >
                  Start conversation
                </Link>
              }
            />
          </div>
        ) : (
          recent.map((conv) => (
            <Link
              key={conv.id}
              href={`/conversations/${conv.id}`}
              className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[var(--color-bg-hover)]"
            >
              {/* Avatar */}
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent-subtle)] text-[var(--color-accent)]">
                <svg width="13" height="13" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
                  <path d="M14 2H0v8a1 1 0 0 0 1 1h2v3l4-3h7a1 1 0 0 0 1-1V2z" />
                </svg>
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)]">
                  {conv.title ?? 'Untitled conversation'}
                </span>
                <span className="text-xs text-[var(--color-text-tertiary)]">
                  {conv.messageCount} message{conv.messageCount !== 1 ? 's' : ''} ·{' '}
                  {formatRelativeTime(conv.lastMessageAt)}
                </span>
              </div>
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="currentColor"
                className="shrink-0 text-[var(--color-text-disabled)] group-hover:text-[var(--color-accent)] transition-colors"
                aria-hidden="true"
              >
                <path
                  d="M4.5 2l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.25"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

function ChatEmptyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
      <path d="M18 2H2v11a1 1 0 0 0 1 1h3v4l5-4h8a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1zM6 8h8v1.5H6V8zm0 3h5v1.5H6V11z" />
    </svg>
  );
}
