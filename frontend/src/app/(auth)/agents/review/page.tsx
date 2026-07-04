'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, CheckCircle2, XCircle, Edit3, AlertCircle, Clock } from 'lucide-react';
import { PremiumBackground } from '@/components/landing/PremiumBackground';
import { useReviewQueue, useReviewQueueStats, useSubmitReview } from '@/hooks/useAgents';
import { useToast } from '@/contexts/ToastContext';
import { formatRelativeTime } from '@/lib/time';
import type { ReviewQueueItem, ReviewVerdict } from '@/types/clarity';

const PRIORITY_COLORS = {
  low: 'text-[#4A5168] bg-white/[0.04]',
  medium: 'text-blue-400 bg-blue-500/10',
  high: 'text-amber-400 bg-amber-500/10',
  critical: 'text-red-400 bg-red-500/10',
};

function ReviewCard({ item }: { item: ReviewQueueItem }) {
  const { toast } = useToast();
  const submit = useSubmitReview();
  const [comment, setComment] = useState('');
  const [editedOutput, setEditedOutput] = useState(item.output);
  const [editMode, setEditMode] = useState(false);

  const handleDecision = (verdict: ReviewVerdict) => {
    submit.mutate({
      itemId: item.id,
      payload: {
        verdict,
        comment: comment || undefined,
        editedOutput: verdict === 'edited' ? editedOutput : undefined,
      },
    }, {
      onSuccess: () => toast.success(`Review submitted: ${verdict}.`),
      onError: () => toast.error('Failed to submit review.'),
    });
  };

  const isPending = item.status === 'pending';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-[#0F1117] border rounded-2xl overflow-hidden ${isPending ? 'border-white/[0.08]' : 'border-white/[0.04] opacity-70'}`}
    >
      <div className="px-5 py-4 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${PRIORITY_COLORS[item.priority]}`}>
              {item.priority}
            </span>
            <span className="text-xs font-semibold text-purple-400">{item.agentName}</span>
            {!isPending && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                item.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' :
                item.status === 'rejected' ? 'bg-red-500/10 text-red-400' :
                'bg-blue-500/10 text-blue-400'
              }`}>
                {item.status}
              </span>
            )}
          </div>
          <div className="mb-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#4A5168] mb-1">Query</p>
            <p className="text-sm text-[#F1F3F9] leading-relaxed">{item.input}</p>
          </div>
          <div className="mb-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#4A5168] mb-1">Agent Output</p>
            {editMode && isPending ? (
              <textarea
                value={editedOutput}
                onChange={e => setEditedOutput(e.target.value)}
                rows={4}
                className="w-full bg-[#090B11] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-[#F1F3F9] focus:outline-none focus:border-purple-500/50 transition-colors resize-none"
              />
            ) : (
              <p className="text-sm text-[#8892AA] leading-relaxed">{item.output}</p>
            )}
          </div>
          <div className="flex items-center gap-4 text-[10px] text-[#4A5168]">
            <span className="flex items-center gap-1"><Clock size={10} />{formatRelativeTime(item.createdAt)}</span>
            {item.trustScore !== null && <span>Trust: {item.trustScore.toFixed(2)}</span>}
            {item.confidence !== null && <span>Confidence: {item.confidence.toFixed(2)}</span>}
            <span className="text-amber-400">{item.reason}</span>
          </div>
        </div>
      </div>

      {isPending && (
        <div className="px-5 py-4 border-t border-white/[0.04] space-y-3">
          <input
            type="text"
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Optional review comment…"
            className="w-full bg-[#090B11] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-[#F1F3F9] placeholder:text-[#4A5168] focus:outline-none focus:border-purple-500/50 transition-colors"
          />
          <div className="flex gap-2">
            <button
              onClick={() => handleDecision('approved')}
              disabled={submit.isPending}
              className="flex-1 py-2 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <CheckCircle2 size={13} />Approve
            </button>
            <button
              onClick={() => { setEditMode(v => !v); }}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors flex items-center justify-center gap-1.5 ${editMode ? 'bg-blue-500/15 border-blue-500/30 text-blue-400' : 'bg-white/[0.03] border-white/[0.06] text-[#4A5168] hover:text-[#F1F3F9]'}`}
            >
              <Edit3 size={13} />Edit
            </button>
            {editMode && (
              <button
                onClick={() => handleDecision('edited')}
                disabled={submit.isPending}
                className="flex-1 py-2 rounded-xl text-xs font-semibold bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border border-blue-500/30 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                Save Edit
              </button>
            )}
            <button
              onClick={() => handleDecision('rejected')}
              disabled={submit.isPending}
              className="flex-1 py-2 rounded-xl text-xs font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <XCircle size={13} />Reject
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default function ReviewQueuePage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  const { data, isLoading, isError } = useReviewQueue({ status: statusFilter || undefined, priority: priorityFilter || undefined });
  const { data: stats } = useReviewQueueStats();

  const items = data?.items ?? [];

  return (
    <div className="relative min-h-screen bg-[#05070B] selection:bg-purple-500/30 pb-32">
      <PremiumBackground glowOpacity={0.08} />
      <div className="relative z-10 mx-auto max-w-4xl px-6 pt-12">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
              <span className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Shield size={22} className="text-amber-400" />
              </span>
              Human Review Queue
            </h1>
            <p className="text-sm text-[#8892AA] mt-1.5 ml-14">
              Agent runs routed here when confidence falls below the configured threshold.
            </p>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Pending', value: stats.pending, color: stats.pending > 0 ? 'text-amber-400' : 'text-[#4A5168]' },
              { label: 'Critical', value: stats.criticalPending, color: stats.criticalPending > 0 ? 'text-red-400' : 'text-[#4A5168]' },
              { label: 'Approved', value: stats.approved, color: 'text-emerald-400' },
              { label: 'Total', value: stats.total, color: 'text-purple-400' },
            ].map(s => (
              <div key={s.label} className="bg-[#0F1117] border border-white/[0.06] rounded-2xl px-5 py-4">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-[#4A5168] mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {[{ label: 'All', value: '' }, { label: 'Pending', value: 'pending' }, { label: 'Approved', value: 'approved' }, { label: 'Rejected', value: 'rejected' }].map(f => (
            <button key={f.value} onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${statusFilter === f.value ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : 'bg-white/[0.03] text-[#4A5168] border-white/[0.06] hover:text-[#F1F3F9]'}`}>
              {f.label}
            </button>
          ))}
          <div className="w-px bg-white/[0.06] mx-1" />
          {[{ label: 'All Priority', value: '' }, { label: 'Critical', value: 'critical' }, { label: 'High', value: 'high' }, { label: 'Medium', value: 'medium' }].map(f => (
            <button key={f.value} onClick={() => setPriorityFilter(f.value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${priorityFilter === f.value ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-white/[0.03] text-[#4A5168] border-white/[0.06] hover:text-[#F1F3F9]'}`}>
              {f.label}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-40 bg-white/[0.03] border border-white/[0.04] rounded-2xl animate-pulse" />)}
          </div>
        )}

        {isError && (
          <div className="flex items-center justify-center gap-3 py-12 bg-[#0F1117] border border-white/[0.06] rounded-2xl">
            <AlertCircle size={18} className="text-red-400" />
            <p className="text-sm text-red-400">Failed to load review queue.</p>
          </div>
        )}

        {!isLoading && !isError && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 bg-[#0F1117] border border-white/[0.06] rounded-2xl text-center">
            <CheckCircle2 size={36} className="text-emerald-400 mb-4" />
            <p className="text-base font-semibold text-[#F1F3F9] mb-1">Queue is clear</p>
            <p className="text-sm text-[#4A5168]">All agent runs are within confidence thresholds.</p>
          </div>
        )}

        {!isLoading && !isError && items.length > 0 && (
          <div className="space-y-4">
            {items.map(item => <ReviewCard key={item.id} item={item} />)}
          </div>
        )}
      </div>
    </div>
  );
}
