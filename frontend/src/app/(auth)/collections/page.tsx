'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Grid3X3, Plus, Search, SlidersHorizontal, ArrowUpDown, Server, FileText, Database, MessageSquare, Layers } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useDocuments } from '@/hooks/useDocuments';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { PremiumBackground } from '@/components/landing/PremiumBackground';
import { CreateCollectionModal } from '@/components/collections/CreateCollectionModal';

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function CollectionsPage() {
  const { activeWorkspace } = useWorkspace();
  const { data: documents } = useDocuments();
  const { devDashboard, answerMetrics } = useDashboardMetrics();
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const indexedDocs = devDashboard.data?.statusCounts?.indexed ?? 0;
  const totalDocs = documents?.length ?? 0;
  const storageUsed = devDashboard.data?.totalStorageBytes ?? 0;
  const totalQueries = answerMetrics.data?.conversationsCreated ?? 0;

  const handleCreateCollection = () => {
    setIsCreateModalOpen(false);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 4000);
  };

  return (
    <div className="relative min-h-screen bg-[#05070B] selection:bg-purple-500/30 selection:text-white pb-20">
      <PremiumBackground glowOpacity={0.15} />

      {/* Coming Soon Toast */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-8 left-1/2 z-50 px-6 py-3 rounded-full bg-blue-500/10 border border-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.15)] backdrop-blur-md flex items-center gap-3"
          >
            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <p className="text-sm font-medium text-blue-400">Knowledge Base creation will be available when backend APIs are ready.</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-8 px-6 py-8 relative z-10">
        
        {/* Header Toolbar */}
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
                placeholder="Search collections... (⌘K)" 
                className="bg-[#0F1117] border border-white/[0.08] rounded-xl pl-9 pr-4 py-2 text-sm text-[#F1F3F9] placeholder:text-[#4A5168] focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 w-64 transition-all"
              />
            </div>
            <button className="p-2 rounded-xl border border-white/[0.08] bg-[#0F1117] text-[#8892AA] hover:text-[#F1F3F9] hover:bg-white/[0.04] transition-all">
              <SlidersHorizontal size={16} />
            </button>
            <button className="p-2 rounded-xl border border-white/[0.08] bg-[#0F1117] text-[#8892AA] hover:text-[#F1F3F9] hover:bg-white/[0.04] transition-all">
              <ArrowUpDown size={16} />
            </button>
            <button 
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500 text-white font-medium text-sm hover:bg-purple-600 transition-colors shadow-[0_0_20px_rgba(168,85,247,0.3)] ml-2"
            >
              <Plus size={16} /> Create Collection
            </button>
          </div>
        </div>

        {/* Knowledge Base Overview Widgets */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-5 hover:border-purple-500/20 transition-colors group">
            <div className="flex items-center gap-3 mb-4 text-[#8892AA]">
              <Layers size={16} className="group-hover:text-purple-400 transition-colors" />
              <h3 className="text-xs font-semibold uppercase tracking-wider">Collections</h3>
            </div>
            <p className="text-3xl font-bold text-[#F1F3F9]">0</p>
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
            <p className="text-3xl font-bold text-[#F1F3F9]">{formatBytes(storageUsed)}</p>
            <p className="text-xs text-[#4A5168] mt-2">Vector database allocation</p>
          </div>
        </div>

        {/* Collections Grid (Empty State) */}
        <section className="mt-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-[#F1F3F9] tracking-tight">Your Collections</h2>
          </div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full rounded-[32px] border border-white/[0.04] bg-[#0F1117]/50 backdrop-blur-sm p-16 flex flex-col items-center justify-center text-center relative overflow-hidden"
          >
            {/* Ambient Background for Empty State */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/10 blur-[100px] rounded-full pointer-events-none" />

            <div className="relative z-10 w-24 h-24 mb-8">
              <div className="absolute inset-0 bg-purple-500/20 rounded-3xl rotate-6 blur-md animate-pulse" />
              <div className="absolute inset-0 bg-[#0F1117] border border-purple-500/30 rounded-3xl flex items-center justify-center shadow-[0_0_40px_rgba(168,85,247,0.2)]">
                <Server size={40} className="text-purple-400" />
              </div>
            </div>
            
            <h3 className="text-3xl font-bold text-white tracking-tight mb-4">Create your first Knowledge Base</h3>
            
            <p className="text-[#8892AA] text-base max-w-lg mb-8 leading-relaxed">
              Collections group related documents together to form powerful, isolated knowledge bases. They improve AI retrieval accuracy and enable team collaboration.
            </p>

            <button 
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 px-8 py-4 rounded-xl bg-purple-500 text-white font-semibold hover:bg-purple-600 hover:scale-105 transition-all duration-300 shadow-[0_0_30px_rgba(168,85,247,0.4)]"
            >
              <Plus size={20} /> Create Collection
            </button>

            <div className="mt-12 pt-8 border-t border-white/[0.04] flex gap-12 w-full max-w-2xl justify-center text-sm font-medium text-[#4A5168]">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-500/50" />
                Isolated vector search
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-500/50" />
                Team access controls
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-500/50" />
                Custom AI instructions
              </div>
            </div>
          </motion.div>
        </section>
      </div>

      <CreateCollectionModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        onCreate={handleCreateCollection}
      />
    </div>
  );
}
