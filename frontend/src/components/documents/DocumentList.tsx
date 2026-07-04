import { useState } from 'react';
import type { Document } from '@/types/clarity';
import { motion, AnimatePresence } from 'framer-motion';
import { DocumentCard } from './DocumentCard';
import { FileUp, Trash2, Tag, Archive } from 'lucide-react';

export function DocumentList({
  documents,
  workspaceId,
  loading = false,
}: {
  documents: Document[];
  workspaceId: string;
  loading?: boolean;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function toggleSelect(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  function selectAll() {
    if (selectedIds.size === documents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(documents.map(d => d.id)));
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="rounded-2xl border border-white/[0.04] bg-[#0F1117] p-5 h-[200px] animate-pulse">
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/5" />
              <div className="flex-1 space-y-3">
                <div className="h-4 bg-white/5 rounded w-3/4" />
                <div className="h-3 bg-white/5 rounded w-1/2" />
              </div>
            </div>
            <div className="mt-8 space-y-2">
              <div className="h-3 bg-white/5 rounded w-full" />
              <div className="h-3 bg-white/5 rounded w-5/6" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-3xl border border-white/[0.04] bg-[#0F1117] p-12 flex flex-col items-center justify-center text-center shadow-2xl relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-purple-500/5 pointer-events-none" />
        <div className="w-20 h-20 rounded-full bg-purple-500/10 flex items-center justify-center mb-6 border border-purple-500/20 relative">
          <FileUp size={32} className="text-purple-400" />
          <motion.div 
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="absolute inset-0 rounded-full border border-purple-400/30"
          />
        </div>
        <h3 className="text-xl font-bold text-[#F1F3F9] tracking-tight mb-2">No documents yet</h3>
        <p className="text-[#8892AA] max-w-md text-sm leading-relaxed mb-8">
          Upload your first PDF or DOCX file using the drag-and-drop zone above. 
          We&apos;ll automatically extract, normalize, and index it for AI retrieval.
        </p>
        <button 
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="bg-white text-black font-semibold px-6 py-2.5 rounded-xl hover:bg-slate-200 transition-colors"
        >
          Upload Document
        </button>
      </motion.div>
    );
  }

  return (
    <>
      {documents.length > 0 && (
        <div className="mb-4 flex items-center justify-between">
          <button 
            onClick={selectAll}
            className="text-xs font-medium text-[#8892AA] hover:text-[#F1F3F9] transition-colors flex items-center gap-2"
          >
            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedIds.size === documents.length ? 'bg-purple-500 border-purple-500' : 'bg-white/5 border-white/20'}`}>
              {selectedIds.size === documents.length && <div className="w-2 h-2 bg-white rounded-sm" />}
            </div>
            Select All
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
        {documents.map((document, i) => (
          <motion.div
            key={document.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.05, 0.5), duration: 0.4, ease: "easeOut" }}
          >
            <DocumentCard 
              document={document} 
              workspaceId={workspaceId} 
              isSelected={selectedIds.has(document.id)}
              onToggleSelect={() => toggleSelect(document.id)}
            />
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-[#151923] border border-white/[0.08] shadow-[0_20px_40px_rgba(0,0,0,0.5)] rounded-full px-6 py-3"
          >
            <span className="text-sm font-semibold text-white bg-white/10 px-3 py-1 rounded-full">
              {selectedIds.size} selected
            </span>
            
            <div className="w-px h-6 bg-white/10" />
            
            <button className="flex items-center gap-2 text-sm text-[#8892AA] hover:text-white transition-colors">
              <Tag size={16} /> Label
            </button>
            <button className="flex items-center gap-2 text-sm text-[#8892AA] hover:text-white transition-colors">
              <Archive size={16} /> Archive
            </button>
            
            <div className="w-px h-6 bg-white/10" />

            <button className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors">
              <Trash2 size={16} /> Delete
            </button>

            <button 
              onClick={() => setSelectedIds(new Set())}
              className="ml-4 p-1 rounded-full hover:bg-white/10 text-[#8892AA] hover:text-white transition-colors"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
