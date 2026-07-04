'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Grid3X3, Plus, Search, LayoutGrid, List, FileText, Database,
  MessageSquare, Layers, Trash2, MoreHorizontal, Loader2,
} from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useDocuments } from '@/hooks/useDocuments';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { useCollections, useDeleteCollection } from '@/hooks/useCollections';
import { PremiumBackground } from '@/components/landing/PremiumBackground';
import { CreateCollectionModal } from '@/components/collections/CreateCollectionModal';
import { useToast } from '@/contexts/ToastContext';
import type { Collection } from '@/types/clarity';

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function CollectionCard({
  collection,
  onDelete,
}: {
  collection: Collection;
  onDelete: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="group bg-[#0F1117] border border-white/[0.06] rounded-2xl p-6 hover:border-white/[0.12] transition-all relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-32 h-32 opacity-10 blur-[40px] rounded-full pointer-events-none" style={{ backgroundColor: collection.color ?? '#6366f1' }} />

      <div className="relative z-10 flex items-start justify-between mb-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold text-white shadow-lg shrink-0"
          style={{ backgroundColor: `${collection.color ?? '#6366f1'}25`, border: `1px solid ${collection.color ?? '#6366f1'}40` }}
        >
          {collection.name.substring(0, 1).toUpperCase()}
        </div>

        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 rounded-lg text-[#4A5168] hover:text-[#F1F3F9] hover:bg-white/[0.04] transition-colors opacity-0 group-hover:opacity-100"
          >
            <MoreHorizontal size={16} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-8 z-20 w-40 bg-[#1A1F2E] border border-white/[0.1] rounded-xl shadow-2xl p-1">
                <button
                  onClick={() => { onDelete(collection.id); setMenuOpen(false); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="relative z-10">
        <h3 className="text-base font-bold text-[#F1F3F9] mb-1 truncate">{collection.name}</h3>
        {collection.description && (
          <p className="text-xs text-[#8892AA] mb-3 line-clamp-2">{collection.description}</p>
        )}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/[0.04]">
          <div className="flex items-center gap-1.5 text-xs text-[#8892AA]">
            <FileText size={12} />
            <span>{collection.documentCount} doc{collection.documentCount !== 1 ? 's' : ''}</span>
          </div>
          <div className="text-xs text-[#4A5168]">{new Date(collection.createdAt).toLocaleDateString()}</div>
        </div>
      </div>
    </motion.div>
  );
}

export default function CollectionsPage() {
  const { activeWorkspace } = useWorkspace();
  const { data: documents } = useDocuments();
  const { devDashboard, answerMetrics } = useDashboardMetrics();
  const collectionsQuery = useCollections();
  const deleteMutation = useDeleteCollection();
  const { toast } = useToast();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const indexedDocs = devDashboard.data?.statusCounts?.indexed ?? 0;
  const totalDocs = documents?.length ?? 0;
  const storageUsed = devDashboard.data?.totalStorageBytes ?? null;
  const totalQueries = answerMetrics.data?.conversationsCreated ?? 0;

  const collections = collectionsQuery.data?.collections ?? [];
  const total = collectionsQuery.data?.total ?? 0;

  const filteredCollections = searchQuery.trim()
    ? collections.filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.description?.toLowerCase().includes(searchQuery.toLowerCase()))
    : collections;

  const handleDelete = async (collectionId: string) => {
    try {
      await deleteMutation.mutateAsync(collectionId);
      toast.success('Collection deleted.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete collection.');
    }
  };

  return (
    <div className="relative min-h-screen bg-[#05070B] selection:bg-purple-500/30 selection:text-white pb-20">
      <PremiumBackground glowOpacity={0.15} />

      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-8 px-6 py-8 relative z-10">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.04] pb-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <Grid3X3 size={20} className="text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#F1F3F9] tracking-tight">Knowledge Bases</h1>
              <p className="text-xs text-[#8892AA] mt-0.5">Organize and manage AI retrieval contexts</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8892AA]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search collections..."
                className="bg-[#0F1117] border border-white/[0.08] rounded-xl pl-9 pr-4 py-2 text-sm text-[#F1F3F9] placeholder:text-[#4A5168] focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 w-56 transition-all"
              />
            </div>
            <div className="flex items-center p-1 rounded-xl border border-white/[0.08] bg-[#0F1117]">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white/[0.06] text-[#F1F3F9]' : 'text-[#4A5168] hover:text-[#8892AA]'}`}
              >
                <LayoutGrid size={14} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white/[0.06] text-[#F1F3F9]' : 'text-[#4A5168] hover:text-[#8892AA]'}`}
              >
                <List size={14} />
              </button>
            </div>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500 text-white font-medium text-sm hover:bg-purple-600 transition-colors shadow-[0_0_20px_rgba(168,85,247,0.3)]"
            >
              <Plus size={16} /> Create Collection
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-5 hover:border-purple-500/20 transition-colors group">
            <div className="flex items-center gap-3 mb-4 text-[#8892AA]">
              <Layers size={16} className="group-hover:text-purple-400 transition-colors" />
              <h3 className="text-xs font-semibold uppercase tracking-wider">Collections</h3>
            </div>
            <p className="text-3xl font-bold text-[#F1F3F9]">{total}</p>
            <p className="text-xs text-[#4A5168] mt-2">Active knowledge bases</p>
          </div>

          <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-5 hover:border-blue-500/20 transition-colors group">
            <div className="flex items-center gap-3 mb-4 text-[#8892AA]">
              <FileText size={16} className="group-hover:text-blue-400 transition-colors" />
              <h3 className="text-xs font-semibold uppercase tracking-wider">Global Documents</h3>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-[#F1F3F9]">{indexedDocs}</p>
              <p className="text-sm font-medium text-[#4A5168]">/ {totalDocs}</p>
            </div>
            <p className="text-xs text-[#4A5168] mt-2">Successfully indexed</p>
          </div>

          <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-5 hover:border-green-500/20 transition-colors group">
            <div className="flex items-center gap-3 mb-4 text-[#8892AA]">
              <MessageSquare size={16} className="group-hover:text-green-400 transition-colors" />
              <h3 className="text-xs font-semibold uppercase tracking-wider">AI Queries</h3>
            </div>
            <p className="text-3xl font-bold text-[#F1F3F9]">{totalQueries}</p>
            <p className="text-xs text-[#4A5168] mt-2">Workspace conversations</p>
          </div>

          <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-5 hover:border-orange-500/20 transition-colors group">
            <div className="flex items-center gap-3 mb-4 text-[#8892AA]">
              <Database size={16} className="group-hover:text-orange-400 transition-colors" />
              <h3 className="text-xs font-semibold uppercase tracking-wider">Storage Used</h3>
            </div>
            <p className="text-3xl font-bold text-[#F1F3F9]">{storageUsed != null ? formatBytes(storageUsed) : '—'}</p>
            <p className="text-xs text-[#4A5168] mt-2">Document storage allocation</p>
          </div>
        </div>

        {/* Collections Grid */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-[#F1F3F9] tracking-tight">
              Your Collections
              {filteredCollections.length > 0 && (
                <span className="ml-2 text-sm font-normal text-[#4A5168]">
                  {filteredCollections.length}{searchQuery ? ` of ${total}` : ''}
                </span>
              )}
            </h2>
          </div>

          {collectionsQuery.isLoading ? (
            <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4' : 'flex flex-col gap-3'}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-[#0F1117] border border-white/[0.04] rounded-2xl p-6 h-40 animate-pulse" />
              ))}
            </div>
          ) : collectionsQuery.isError ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center">
              <p className="text-sm text-red-400">Failed to load collections. {(collectionsQuery.error as Error)?.message}</p>
            </div>
          ) : filteredCollections.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full rounded-[32px] border border-white/[0.04] bg-[#0F1117]/50 p-16 flex flex-col items-center justify-center text-center relative overflow-hidden"
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/10 blur-[100px] rounded-full pointer-events-none" />
              <div className="relative z-10 w-24 h-24 mb-8">
                <div className="absolute inset-0 bg-purple-500/20 rounded-3xl rotate-6 blur-md animate-pulse" />
                <div className="absolute inset-0 bg-[#0F1117] border border-purple-500/30 rounded-3xl flex items-center justify-center shadow-[0_0_40px_rgba(168,85,247,0.2)]">
                  <Grid3X3 size={40} className="text-purple-400" />
                </div>
              </div>
              <h3 className="text-3xl font-bold text-white tracking-tight mb-4 relative z-10">
                {searchQuery ? 'No matching collections' : 'Create your first Knowledge Base'}
              </h3>
              <p className="text-[#8892AA] text-base max-w-lg mb-8 leading-relaxed relative z-10">
                {searchQuery
                  ? `No collections match "${searchQuery}". Try a different search term.`
                  : 'Collections group related documents to form powerful, isolated knowledge bases. They improve AI retrieval accuracy and enable team collaboration.'}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="relative z-10 flex items-center gap-2 px-8 py-4 rounded-xl bg-purple-500 text-white font-semibold hover:bg-purple-600 hover:scale-105 transition-all duration-300 shadow-[0_0_30px_rgba(168,85,247,0.4)]"
                >
                  <Plus size={20} /> Create Collection
                </button>
              )}
            </motion.div>
          ) : (
            <AnimatePresence mode="popLayout">
              <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4' : 'flex flex-col gap-3'}>
                {filteredCollections.map((collection) => (
                  <CollectionCard
                    key={collection.id}
                    collection={collection}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </AnimatePresence>
          )}

          {deleteMutation.isPending && (
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#151923] border border-white/[0.08] shadow-2xl rounded-full px-6 py-3">
              <Loader2 size={16} className="animate-spin text-purple-400" />
              <span className="text-sm font-medium text-[#F1F3F9]">Deleting collection...</span>
            </div>
          )}
        </section>
      </div>

      <CreateCollectionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={() => toast.success('Collection created.')}
      />
    </div>
  );
}
