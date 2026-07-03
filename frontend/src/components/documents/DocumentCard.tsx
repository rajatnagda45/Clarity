import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, MoreHorizontal, Search, Cpu, Database, Layers, MessageSquare, Trash2, Edit2, Check } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import type { Document } from '@/types/clarity';
import { formatRelativeTime } from '@/lib/time';

function statusTone(status: Document['status']) {
  if (status === 'indexed') return { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20' };
  if (status === 'failed') return { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' };
  if (['indexing', 'awaiting_index', 'embedded', 'embedding', 'awaiting_embeddings', 'chunked', 'chunking', 'awaiting_chunking'].includes(status)) {
    return { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' };
  }
  return { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' };
}

function statusMessage(status: Document['status']): string {
  if (status === 'uploaded') return 'Stored securely. Queued for extraction.';
  if (status === 'extracted') return 'Text extracted. Awaiting normalization.';
  if (status === 'normalized') return 'Text normalized. Awaiting metadata.';
  if (status === 'metadata_ready') return 'Preprocessing complete. Awaiting chunking.';
  if (status === 'awaiting_chunking') return 'Queued for clause-aware chunking.';
  if (status === 'chunking') return 'Generating chunks...';
  if (status === 'chunked') return 'Chunk generation complete.';
  if (status === 'awaiting_embeddings') return 'Queued for embedding generation.';
  if (status === 'embedding') return 'Generating embeddings...';
  if (status === 'embedded') return 'Embeddings complete. Awaiting indexing.';
  if (status === 'awaiting_index') return 'Queued for vector indexing.';
  if (status === 'indexing') return 'Synchronizing to vector index...';
  if (status === 'indexed') return 'Ready for AI retrieval.';
  return 'Document ingestion failed.';
}

export function DocumentCard({
  document,
  workspaceId,
  isSelected = false,
  onToggleSelect,
}: {
  document: Document;
  workspaceId: string;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const tone = statusTone(document.status);
  const isReady = document.status === 'indexed';
  const isFailed = document.status === 'failed';
  const isProcessing = !isReady && !isFailed;

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    window.document.addEventListener('mousedown', handleClickOutside);
    return () => window.document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <motion.article 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className={`group relative rounded-2xl border transition-all duration-300 p-5 overflow-hidden
        ${isSelected 
          ? 'bg-purple-500/5 border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.1)]' 
          : 'bg-[#0F1117] border-white/[0.06] shadow-xl hover:border-white/[0.15] hover:shadow-2xl hover:shadow-purple-500/5'
        }
      `}
    >
      {/* Subtle hover glow */}
      {!isSelected && (
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 via-purple-500/0 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      )}
      
      {isProcessing && (
        <div className="absolute top-0 left-0 w-full h-[2px] overflow-hidden opacity-50">
          <motion.div 
            className="h-full bg-gradient-to-r from-transparent via-purple-500 to-transparent w-1/2"
            animate={{ x: ['-100%', '200%'] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
          />
        </div>
      )}

      {/* Selection Checkbox */}
      {onToggleSelect && (
        <div 
          onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
          className={`absolute top-4 left-4 w-5 h-5 rounded border z-20 flex items-center justify-center cursor-pointer transition-colors opacity-0 group-hover:opacity-100 focus-within:opacity-100
            ${isSelected ? 'opacity-100 bg-purple-500 border-purple-500' : 'bg-white/5 border-white/20 hover:border-white/40'}
          `}
        >
          {isSelected && <Check size={12} className="text-white" strokeWidth={3} />}
        </div>
      )}

      <div className={`flex items-start justify-between gap-4 relative z-10 ${onToggleSelect ? 'pl-8' : ''}`}>
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl border ${tone.border} ${tone.bg} ${tone.text} flex items-center justify-center`}>
            <FileText size={20} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[#F1F3F9] group-hover:text-purple-400 transition-colors line-clamp-1">{document.filename}</h3>
            <div className="mt-1 flex items-center gap-2 text-xs text-[#4A5168]">
              <span className="uppercase tracking-wider font-medium">{document.sourceType}</span>
              <span>•</span>
              <span>{formatRelativeTime(document.createdAt)}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3 relative">
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase border ${tone.border} ${tone.bg} ${tone.text} flex items-center gap-1.5`}>
            {isProcessing && <span className="flex h-1.5 w-1.5 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current"></span></span>}
            {document.status.replace(/_/g, ' ')}
          </span>
          
          {/* Context Menu Button */}
          <div ref={menuRef} className="relative">
            <button 
              onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
              className={`p-1.5 rounded-lg transition-colors ${showMenu ? 'bg-white/[0.08] text-[#F1F3F9]' : 'text-[#4A5168] hover:text-[#F1F3F9] hover:bg-white/[0.04]'}`}
            >
              <MoreHorizontal size={16} />
            </button>
            
            <AnimatePresence>
              {showMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 5 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-white/[0.08] bg-[#151923] p-1 shadow-2xl z-50 origin-top-right"
                >
                  <Link href={`/dashboard/chat?document=${document.id}`} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#F1F3F9] hover:bg-purple-500/10 hover:text-purple-400 transition-colors">
                    <MessageSquare size={14} /> Ask AI
                  </Link>
                  <Link href={`/documents/${document.id}?workspace=${encodeURIComponent(workspaceId)}`} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#F1F3F9] hover:bg-white/[0.04] transition-colors">
                    <Search size={14} /> Clause Map
                  </Link>
                  <div className="h-px bg-white/[0.04] my-1 mx-2" />
                  <button className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors text-left">
                    <Trash2 size={14} /> Delete
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className={`mt-4 relative z-10 ${onToggleSelect ? 'pl-8' : ''}`}>
        {document.error ? (
          <p className="text-sm text-red-400">{document.error}</p>
        ) : (
          <p className="text-sm text-[#8892AA]">{statusMessage(document.status)}</p>
        )}
      </div>

      {/* Hover Action Bar */}
      {workspaceId && isReady && (
        <div className={`mt-5 flex flex-wrap gap-2 relative z-10 opacity-70 group-hover:opacity-100 transition-opacity ${onToggleSelect ? 'pl-8' : ''}`}>
          <Link
            href={`/dashboard/chat?document=${document.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-xs font-medium text-purple-400 transition hover:bg-purple-500/20"
          >
            <MessageSquare size={12} /> Summarize
          </Link>
          <Link
            href={`/documents/${document.id}/chunks?workspace=${encodeURIComponent(workspaceId)}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-xs font-medium text-[#8892AA] transition hover:border-white/[0.15] hover:text-[#F1F3F9] hover:bg-white/[0.06]"
          >
            <Layers size={12} /> Chunks
          </Link>
          <Link
            href={`/documents/${document.id}/vectors?workspace=${encodeURIComponent(workspaceId)}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-xs font-medium text-[#8892AA] transition hover:border-white/[0.15] hover:text-[#F1F3F9] hover:bg-white/[0.06]"
          >
            <Database size={12} /> Vectors
          </Link>
        </div>
      )}
    </motion.article>
  );
}
