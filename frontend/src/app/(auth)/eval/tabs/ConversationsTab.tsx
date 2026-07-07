'use client';

import { MessageSquare } from 'lucide-react';
import { SectionHeader, EvalEmptyState, LoadingGrid } from './_shared';
import { useConversationEvals } from '@/hooks/useEvaluation';

export function ConversationsTab() {
  const { data: convEvals, isLoading } = useConversationEvals(30);

  if (isLoading) return <LoadingGrid cols={1} rows={4} />;
  if (!convEvals?.conversations.length) return <EvalEmptyState icon={MessageSquare} title="No conversation eval data" sub="Conversation-level metrics appear after AI chat sessions with LLM-as-Judge evaluations." />;

  return (
    <div className="space-y-6">
      <SectionHeader title="Conversation Evaluation" sub="Per-conversation AI quality aggregates" />
      <div className="space-y-3">
        {convEvals.conversations.map(conv => (
          <div key={conv.conversationId} className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-mono text-[#8892AA]">{conv.conversationId.slice(0, 16)}…</p>
                <p className="text-xs text-[#4A5168] mt-0.5">{new Date(conv.createdAt).toLocaleDateString()} · {conv.messageCount} message{conv.messageCount !== 1 ? 's' : ''}</p>
              </div>
              {conv.abstentionCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs text-amber-400 bg-amber-400/10">{conv.abstentionCount} abstention{conv.abstentionCount !== 1 ? 's' : ''}</span>
              )}
            </div>
            <div className="grid grid-cols-4 gap-4 text-xs">
              <div><p className="text-[#4A5168]">Judge</p><p className="text-[#F1F3F9] font-semibold">{conv.avgJudgeOverall?.toFixed(1) ?? '—'}/10</p></div>
              <div><p className="text-[#4A5168]">Trust</p><p className="text-[#F1F3F9] font-semibold">{conv.avgTrustOverall != null ? `${(conv.avgTrustOverall * 100).toFixed(0)}%` : '—'}</p></div>
              <div><p className="text-[#4A5168]">Hallucination Risk</p><p className="text-[#F1F3F9] font-semibold">{conv.avgHallucinationRisk?.toFixed(1) ?? '—'}/10</p></div>
              <div><p className="text-[#4A5168]">Citation Quality</p><p className="text-[#F1F3F9] font-semibold">{conv.avgCitationQuality?.toFixed(1) ?? '—'}/10</p></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
