'use client';

import { useUser } from '@clerk/nextjs';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { motion } from 'framer-motion';
import { 
  BadgeCheck, Building2, Calendar, FileText, MessageSquare, 
  Settings, Copy, Sparkles, Camera
} from 'lucide-react';
import { useState } from 'react';

export function AccountOverviewTab() {
  const { user } = useUser();
  const { activeWorkspace } = useWorkspace();
  const { devDashboard, answerMetrics } = useDashboardMetrics();
  
  const [copied, setCopied] = useState(false);
  
  const totalDocuments = devDashboard.data?.documents.length || 0;
  const totalQueries = answerMetrics.data?.messagesCreated || 0;

  if (!user) return null;

  const handleCopyId = () => {
    navigator.clipboard.writeText(user.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col animate-in fade-in duration-500 max-w-5xl">
      {/* Hero Section */}
      <div className="relative rounded-2xl border border-white/[0.08] bg-[#0F1117] overflow-hidden mb-8 shadow-2xl">
        {/* Cover Image */}
        <div className="h-48 w-full bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 relative group">
          <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay"></div>
          <button className="absolute top-4 right-4 bg-black/40 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-lg text-xs font-medium text-white flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera size={14} />
            Edit Cover
          </button>
        </div>

        {/* Profile Info */}
        <div className="px-8 pb-8">
          <div className="relative flex justify-between items-end -mt-16 mb-6">
            <div className="relative group cursor-pointer">
              <img 
                src={user.imageUrl} 
                alt={user.fullName || 'User'} 
                className="w-32 h-32 rounded-2xl border-4 border-[#0F1117] object-cover shadow-xl"
              />
              <div className="absolute inset-0 bg-black/60 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center border-4 border-transparent">
                <Camera size={24} className="text-white" />
              </div>
              <div className="absolute -bottom-2 -right-2 bg-blue-500 text-white p-1.5 rounded-full border-4 border-[#0F1117]">
                <BadgeCheck size={18} />
              </div>
            </div>
            
            <div className="flex gap-3">
              <button 
                onClick={handleCopyId}
                className="px-4 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
              >
                {copied ? <BadgeCheck size={16} className="text-green-400" /> : <Copy size={16} />}
                {copied ? 'Copied ID' : 'Copy User ID'}
              </button>
              <button className="px-4 py-2 bg-white text-black hover:bg-slate-200 rounded-xl text-sm font-medium transition-colors flex items-center gap-2">
                <Settings size={16} />
                Edit Profile
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
              {user.fullName}
            </h1>
            <p className="text-[#8892AA] flex items-center gap-2">
              {user.primaryEmailAddress?.emailAddress}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 mt-6 pt-6 border-t border-white/[0.04]">
            <div className="flex items-center gap-2 text-sm text-[#8892AA]">
              <Building2 size={16} className="text-purple-400" />
              <span>{activeWorkspace?.name || 'Personal Workspace'}</span>
              <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 text-xs font-semibold ml-1">
                {activeWorkspace?.plan || 'Free'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-[#8892AA]">
              <Calendar size={16} />
              <span>Joined {user.createdAt ? new Date(user.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : 'Recently'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* AI Usage Summary */}
      <h2 className="text-lg font-semibold text-white mb-4">AI Usage Summary</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <motion.div 
          whileHover={{ y: -2 }}
          className="p-6 rounded-2xl bg-[#0F1117] border border-white/[0.08] relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:opacity-40 transition-opacity">
            <FileText size={48} className="text-blue-400" />
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <FileText size={20} />
            </div>
            <h3 className="font-medium text-[#8892AA]">Documents</h3>
          </div>
          <p className="text-3xl font-bold text-white">{totalDocuments}</p>
        </motion.div>

        <motion.div 
          whileHover={{ y: -2 }}
          className="p-6 rounded-2xl bg-[#0F1117] border border-white/[0.08] relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:opacity-40 transition-opacity">
            <Sparkles size={48} className="text-purple-400" />
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <Sparkles size={20} />
            </div>
            <h3 className="font-medium text-[#8892AA]">AI Queries</h3>
          </div>
          <p className="text-3xl font-bold text-white">{totalQueries}</p>
        </motion.div>

        <motion.div 
          whileHover={{ y: -2 }}
          className="p-6 rounded-2xl bg-[#0F1117] border border-white/[0.08] relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:opacity-40 transition-opacity">
            <MessageSquare size={48} className="text-emerald-400" />
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <MessageSquare size={20} />
            </div>
            <h3 className="font-medium text-[#8892AA]">Active Chats</h3>
          </div>
          <p className="text-3xl font-bold text-white">{totalQueries > 0 ? 12 : 0}</p>
        </motion.div>
      </div>

    </div>
  );
}
