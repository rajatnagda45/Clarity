import { motion } from 'framer-motion';
import { FileText, Link as LinkIcon, AlertTriangle, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { TrustBadge } from '@/components/chat/TrustBadge';
import { DebatePanel, type DebateTurn } from '@/components/chat/DebatePanel';
import { AbstentionCard } from '@/components/chat/AbstentionCard';
import type { Citation, Workspace } from '@/types/clarity';

interface ChatContextPanelProps {
  workspaceId: string;
  activeWorkspace: Workspace | null;
  citations: Citation[];
  streamingTrust: { raw: number; calibrated: number; components: Record<string, number> } | null;
  streamingDebateTurns: DebateTurn[];
  streamingAbstention: { reason: string; trustScore: number; threshold: number; missingEvidenceQuery?: string } | null;
}

export function ChatContextPanel({
  workspaceId,
  activeWorkspace,
  citations,
  streamingTrust,
  streamingDebateTurns,
  streamingAbstention
}: ChatContextPanelProps) {
  // Deduplicate citations by documentId for "Active Documents" list
  const activeDocs = Array.from(new Set(citations.map(c => c.documentId)));

  return (
    <div className="w-[320px] flex-shrink-0 h-full bg-[#05070B] border-l border-white/[0.04] flex flex-col pt-6 overflow-y-auto scrollbar-hide">
      
      {/* Workspace Summary */}
      <div className="px-6 mb-8">
        <h3 className="text-[10px] uppercase tracking-wider font-bold text-[#4A5168] mb-3">Context Environment</h3>
        <div className="bg-[#0F1117] border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <ShieldCheck size={16} className="text-purple-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#F1F3F9]">{activeWorkspace?.name || 'Active Workspace'}</p>
              <p className="text-xs text-[#8892AA]">Grounded AI Response</p>
            </div>
          </div>
        </div>
      </div>

      {/* AI Confidence & Processing Status */}
      {(streamingTrust || streamingDebateTurns.length > 0 || streamingAbstention) && (
        <div className="px-6 mb-8 flex flex-col gap-4">
          <h3 className="text-[10px] uppercase tracking-wider font-bold text-[#4A5168]">AI Confidence</h3>
          
          {streamingAbstention && (
            <AbstentionCard
              reason={streamingAbstention.reason}
              trustScore={streamingAbstention.trustScore}
              threshold={streamingAbstention.threshold}
              missingEvidenceQuery={streamingAbstention.missingEvidenceQuery}
            />
          )}

          {streamingTrust && (
            <TrustBadge
              raw={streamingTrust.raw}
              calibrated={streamingTrust.calibrated}
              components={streamingTrust.components}
            />
          )}

          {streamingDebateTurns.length > 0 && (
            <DebatePanel turns={streamingDebateTurns} />
          )}
        </div>
      )}

      {/* Rich Citations */}
      <div className="px-6 mb-6">
        <h3 className="text-[10px] uppercase tracking-wider font-bold text-[#4A5168] mb-3 flex items-center justify-between">
          <span>Sources & Citations</span>
          <span className="bg-white/5 px-2 py-0.5 rounded text-white font-mono">{citations.length}</span>
        </h3>
        
        {citations.length === 0 ? (
          <div className="text-center p-6 border border-white/[0.04] border-dashed rounded-xl">
            <FileText size={20} className="mx-auto text-[#4A5168] mb-2" />
            <p className="text-xs text-[#8892AA]">No sources referenced yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {citations.map((citation, idx) => (
              <motion.div 
                key={`${citation.citationKey}-${idx}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="group bg-[#0F1117] border border-white/[0.06] rounded-xl p-3 hover:border-purple-500/30 hover:bg-purple-500/5 transition-all"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="bg-white/5 p-1.5 rounded-lg text-[#8892AA]">
                      <FileText size={14} />
                    </div>
                    <span className="text-xs font-semibold text-purple-400 font-mono">
                      {citation.citationKey}
                    </span>
                  </div>
                  <Link 
                    href={`/documents/${citation.documentId}/chunks?workspace=${encodeURIComponent(workspaceId)}&highlight=${encodeURIComponent(citation.chunkId)}`}
                    className="text-white/40 hover:text-white transition-colors"
                    title="Open Document"
                  >
                    <LinkIcon size={12} />
                  </Link>
                </div>
                
                {citation.sectionTitle && (
                  <p className="text-xs font-medium text-[#F1F3F9] mb-1 line-clamp-1">
                    {citation.sectionTitle}
                  </p>
                )}
                
                <div className="flex items-center gap-2 mt-2 text-[10px] font-medium text-[#4A5168] uppercase tracking-wider">
                  <span>Page {citation.pageStart}</span>
                  {citation.clauseNumber && (
                    <>
                      <span>•</span>
                      <span>Clause {citation.clauseNumber}</span>
                    </>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
