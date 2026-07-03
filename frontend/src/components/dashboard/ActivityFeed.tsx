'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';
import type { Document, Conversation } from '@/types/clarity';
import { EmptyState } from '@/components/ds/EmptyState';
import { formatRelativeTime } from '@/lib/time';

interface ActivityFeedProps {
  documents: Document[];
  conversations: Conversation[];
  loading?: boolean;
}

type ActivityType = 'upload' | 'indexed' | 'failed' | 'conversation';

interface ActivityItem {
  type: ActivityType;
  label: string;
  time: string;
}

const DOT_COLORS: Record<ActivityType, string> = {
  upload: '#F59E0B',
  indexed: '#22C55E',
  failed: '#EF4444',
  conversation: '#5B6EF0',
};

function SkeletonItem() {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="mt-1 h-3 w-3 rounded-full bg-[rgba(255,255,255,0.06)] skeleton-shimmer" />
        <div className="flex-1 w-px bg-[rgba(255,255,255,0.06)]" style={{ minHeight: 24 }} />
      </div>
      <div className="flex-1 pb-4">
        <div className="h-4 w-3/4 rounded bg-[rgba(255,255,255,0.06)] skeleton-shimmer" />
        <div className="mt-1.5 h-3 w-1/3 rounded bg-[rgba(255,255,255,0.06)] skeleton-shimmer" />
      </div>
    </div>
  );
}

export function ActivityFeed({ documents, conversations, loading }: ActivityFeedProps) {
  const items = useMemo<ActivityItem[]>(() => {
    const docItems: ActivityItem[] = documents.map((doc) => ({
      type:
        doc.status === 'indexed'
          ? 'indexed'
          : doc.status === 'failed'
          ? 'failed'
          : 'upload',
      label: doc.filename,
      time: doc.createdAt,
    }));

    const convItems: ActivityItem[] = conversations.map((conv) => ({
      type: 'conversation' as ActivityType,
      label: conv.title ?? 'Untitled conversation',
      time: conv.lastMessageAt,
    }));

    return [...docItems, ...convItems]
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 8);
  }, [documents, conversations]);

  const isEmpty = !loading && documents.length === 0 && conversations.length === 0;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#0F1117] shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.04]">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-orange-500/10 p-2 text-orange-400">
            <Activity size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-[#F1F3F9] tracking-tight text-lg">Activity Feed</h3>
            <p className="text-xs text-[#8892AA]">Recent workspace events</p>
          </div>
        </div>
      </div>
      
      <div className="p-6 h-full overflow-y-auto">
        {loading ? (
          <div className="flex flex-col">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonItem key={i} />
            ))}
          </div>
        ) : isEmpty ? (
          <EmptyState
            icon={<Activity size={18} />}
            title="No recent activity"
            description="Activity will appear as you use the workspace."
          />
        ) : (
          <div className="flex flex-col">
            {items.map((item, index) => (
              <motion.div
                key={`${item.type}-${item.time}-${index}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05, duration: 0.2 }}
                className="flex gap-3"
              >
                {/* Timeline */}
                <div className="flex flex-col items-center">
                  <div
                    className="mt-1 h-3 w-3 shrink-0 rounded-full"
                    style={{ background: DOT_COLORS[item.type] }}
                  />
                  {index < items.length - 1 && (
                    <div className="flex-1 w-px bg-[rgba(255,255,255,0.06)]" style={{ minHeight: 20 }} />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 pb-4">
                  <p className="truncate text-sm text-[#F1F3F9]">{item.label}</p>
                  <p className="mt-0.5 text-xs text-[#4A5168]">{formatRelativeTime(item.time)}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
