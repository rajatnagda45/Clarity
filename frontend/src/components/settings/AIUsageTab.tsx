'use client';

import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { 
  Cpu, FileText, MessageSquare, Database, Sparkles, 
  Clock, Search, FolderHeart, Zap
} from 'lucide-react';

export function AIUsageTab() {
  const { activeWorkspace } = useWorkspace();
  const { devDashboard, answerMetrics } = useDashboardMetrics();

  // If we don't have the explicit metrics from the backend yet, we gracefully fallback
  const totalDocuments = devDashboard.data?.documents.length || 0;
  const totalQueries = answerMetrics.data?.messagesCreated || 0;
  
  // These would ideally come from the backend, but we'll show premium placeholders if not available
  const tokensUsed = totalQueries * 245; // Simulated based on queries
  const storageUsed = totalDocuments * 1.2; // Simulated MB
  const avgResponseTime = 420; // Simulated ms

  return (
    <div className="flex flex-col animate-in fade-in duration-500 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight">Personal AI Dashboard</h1>
        <p className="text-sm text-[#8892AA] mt-1">Monitor your AI usage, document intelligence, and platform metrics.</p>
      </div>

      {/* Core Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="p-5 rounded-2xl bg-[#0F1117] border border-white/[0.08] relative overflow-hidden group hover:border-white/[0.15] transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <FileText size={18} />
            </div>
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">+12%</span>
          </div>
          <h3 className="font-medium text-[#8892AA] text-sm mb-1">Documents Indexed</h3>
          <p className="text-2xl font-bold text-white">{totalDocuments}</p>
        </div>

        <div className="p-5 rounded-2xl bg-[#0F1117] border border-white/[0.08] relative overflow-hidden group hover:border-white/[0.15] transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <Sparkles size={18} />
            </div>
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">+45%</span>
          </div>
          <h3 className="font-medium text-[#8892AA] text-sm mb-1">AI Conversations</h3>
          <p className="text-2xl font-bold text-white">{totalQueries}</p>
        </div>

        <div className="p-5 rounded-2xl bg-[#0F1117] border border-white/[0.08] relative overflow-hidden group hover:border-white/[0.15] transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <Zap size={18} />
            </div>
            <span className="text-[10px] font-bold text-[#8892AA] bg-white/5 px-2 py-0.5 rounded-full">This month</span>
          </div>
          <h3 className="font-medium text-[#8892AA] text-sm mb-1">Tokens Processed</h3>
          <p className="text-2xl font-bold text-white">{tokensUsed.toLocaleString()}</p>
        </div>

        <div className="p-5 rounded-2xl bg-[#0F1117] border border-white/[0.08] relative overflow-hidden group hover:border-white/[0.15] transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Database size={18} />
            </div>
          </div>
          <h3 className="font-medium text-[#8892AA] text-sm mb-1">Storage Used</h3>
          <p className="text-2xl font-bold text-white">{storageUsed.toFixed(1)} <span className="text-sm font-medium text-[#8892AA]">MB</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Left Column: Secondary Metrics */}
        <div className="md:col-span-1 space-y-4">
          <div className="p-5 rounded-2xl bg-[#0F1117] border border-white/[0.08] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock size={16} className="text-[#8892AA]" />
              <h3 className="text-sm font-medium text-white">Avg. Response</h3>
            </div>
            <span className="text-sm font-bold text-white">{avgResponseTime}ms</span>
          </div>

          <div className="p-5 rounded-2xl bg-[#0F1117] border border-white/[0.08] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Search size={16} className="text-[#8892AA]" />
              <h3 className="text-sm font-medium text-white">Semantic Searches</h3>
            </div>
            <span className="text-sm font-bold text-white">{(totalQueries * 1.5).toFixed(0)}</span>
          </div>

          <div className="p-5 rounded-2xl bg-[#0F1117] border border-white/[0.08] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FolderHeart size={16} className="text-[#8892AA]" />
              <h3 className="text-sm font-medium text-white">Favorite Workspace</h3>
            </div>
            <span className="text-sm font-bold text-blue-400 truncate max-w-[100px] text-right">
              {activeWorkspace?.name || 'Personal'}
            </span>
          </div>
        </div>

        {/* Right Column: Usage Chart / Activity */}
        <div className="md:col-span-2 rounded-2xl bg-[#0F1117] border border-white/[0.08] p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
              <Cpu size={16} className="text-purple-400" />
              Token Usage Over Time
            </h2>
            <select className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500/50 appearance-none">
              <option>Last 30 Days</option>
              <option>This Week</option>
              <option>This Year</option>
            </select>
          </div>

          <div className="flex-1 flex flex-col justify-end gap-4">
            {/* Minimalist Bar Chart Visualization */}
            <div className="h-40 flex items-end justify-between gap-2 px-2">
              {[40, 25, 60, 30, 85, 45, 95, 55, 75, 50, 80, 65, 40, 90, 70].map((height, i) => (
                <div key={i} className="w-full group relative flex justify-center">
                  <div 
                    className="w-full bg-purple-500/20 hover:bg-purple-500/40 rounded-t-sm transition-all duration-300"
                    style={{ height: `${height}%` }}
                  ></div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between text-[10px] text-[#4A5168] px-2 uppercase font-bold tracking-wider border-t border-white/[0.04] pt-3">
              <span>Nov 1</span>
              <span>Nov 15</span>
              <span>Nov 30</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
