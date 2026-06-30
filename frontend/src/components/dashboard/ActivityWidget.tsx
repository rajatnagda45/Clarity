'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/cn';
import type { Document, Conversation } from '@/types/clarity';

interface ActivityWidgetProps {
  documents: Document[];
  conversations: Conversation[];
  loading?: boolean;
}

interface ActivityItem {
  id: string;
  type: 'upload' | 'indexed' | 'failed' | 'conversation' | 'embedding';
  label: string;
  sub: string;
  timestamp: Date;
  icon: React.ReactNode;
  dotColor: string;
}

function formatTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ActivityWidget({ documents, conversations, loading = false }: ActivityWidgetProps) {
  const activities = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = [];

    for (const doc of documents) {
      items.push({
        id: `doc-upload-${doc.id}`,
        type: 'upload',
        label: `Uploaded ${doc.filename}`,
        sub: doc.sourceType.toUpperCase(),
        timestamp: new Date(doc.createdAt),
        icon: <UploadDot />,
        dotColor: 'bg-[var(--color-accent)]',
      });

      if (doc.status === 'indexed') {
        items.push({
          id: `doc-indexed-${doc.id}`,
          type: 'indexed',
          label: `${doc.filename} fully indexed`,
          sub: 'Ready for search',
          timestamp: new Date(doc.createdAt),
          icon: <CheckDot />,
          dotColor: 'bg-[var(--color-success)]',
        });
      }

      if (doc.status === 'failed') {
        items.push({
          id: `doc-failed-${doc.id}`,
          type: 'failed',
          label: `Processing failed for ${doc.filename}`,
          sub: doc.error ?? 'Unknown error',
          timestamp: new Date(doc.createdAt),
          icon: <ErrorDot />,
          dotColor: 'bg-[var(--color-error)]',
        });
      }
    }

    for (const conv of conversations) {
      items.push({
        id: `conv-${conv.id}`,
        type: 'conversation',
        label: conv.title ?? 'New conversation started',
        sub: `${conv.messageCount} message${conv.messageCount !== 1 ? 's' : ''}`,
        timestamp: new Date(conv.lastMessageAt),
        icon: <ChatDot />,
        dotColor: 'bg-[var(--color-warning)]',
      });
    }

    return items
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 8);
  }, [documents, conversations]);

  return (
    <div className="flex flex-col rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Activity</h3>
        {activities.length > 0 && (
          <span className="text-xs text-[var(--color-text-tertiary)]">Last {activities.length} events</span>
        )}
      </div>

      <div className="flex flex-col px-5 pb-4">
        {loading ? (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--color-bg-elevated)]" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <div className="h-3.5 w-3/4 rounded bg-[var(--color-bg-elevated)]" />
                  <div className="h-3 w-1/2 rounded bg-[var(--color-bg-elevated)]" />
                </div>
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-bg-elevated)] text-[var(--color-text-tertiary)]">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zM7 5h2v5H7V5zm0 6h2v2H7v-2z" />
              </svg>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)]">No activity yet</p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[5px] top-2 bottom-2 w-px bg-[var(--color-border-subtle)]" aria-hidden="true" />
            <div className="flex flex-col gap-4">
              {activities.map((item) => (
                <div key={item.id} className="flex items-start gap-3">
                  <div
                    className={cn(
                      'relative mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-[var(--color-bg-surface)]',
                      item.dotColor,
                    )}
                    aria-hidden="true"
                  />
                  <div className="flex flex-1 min-w-0 flex-col">
                    <span className="truncate text-sm text-[var(--color-text-primary)]">
                      {item.label}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-[var(--color-text-tertiary)]">{item.sub}</span>
                      <span className="text-[var(--color-text-disabled)]">·</span>
                      <span className="text-xs text-[var(--color-text-tertiary)]">
                        {formatTime(item.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function UploadDot() {
  return null;
}
function CheckDot() {
  return null;
}
function ErrorDot() {
  return null;
}
function ChatDot() {
  return null;
}
