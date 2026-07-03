'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building2, Users, Shield, Key, History, Puzzle, Activity, 
  Copy, Plus, Settings, Upload, MessageSquare, Database, FileText, CheckCircle2,
  Lock, AlertTriangle, Fingerprint, HardDrive
} from 'lucide-react';

import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useDocuments } from '@/hooks/useDocuments';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { PremiumBackground } from '@/components/landing/PremiumBackground';
import { CreateWorkspaceModal } from '@/components/workspace/CreateWorkspaceModal';
import { useToast } from '@/contexts/ToastContext';

const TABS = [
  { id: 'overview', label: 'Overview', icon: Building2 },
  { id: 'members', label: 'Members', icon: Users },
  { id: 'roles', label: 'Roles & Permissions', icon: Shield },
  { id: 'security', label: 'Security', icon: Lock },
  { id: 'api', label: 'API Keys', icon: Key },
  { id: 'audit', label: 'Audit Logs', icon: History },
  { id: 'integrations', label: 'Integrations', icon: Puzzle },
  { id: 'usage', label: 'Usage', icon: Activity },
];

const PALETTE = [
  '#6366f1', '#0ea5e9', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6',
];

function wsColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function WorkspaceManagementPage() {
  const { activeWorkspace, workspaces, setActiveWorkspace } = useWorkspace();
  const { data: documents } = useDocuments();
  const { devDashboard, answerMetrics } = useDashboardMetrics();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [createOpen, setCreateOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const handleCopyId = () => {
    if (!activeWorkspace) return;
    navigator.clipboard.writeText(activeWorkspace.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const indexedDocs = devDashboard.data?.statusCounts?.indexed ?? 0;
  const totalDocs = documents?.length ?? 0;
  const storageUsed = devDashboard.data?.totalStorageBytes ?? 0;
  const queries = answerMetrics.data?.conversationsCreated ?? 0;

  if (!activeWorkspace) return null;

  return (
    <div className="relative min-h-screen bg-[#05070B] selection:bg-purple-500/30 selection:text-white pb-32">
      <PremiumBackground glowOpacity={0.15} />

      <div className="mx-auto flex w-full max-w-[1200px] flex-col px-6 pt-12 pb-8 relative z-10">
        
        {/* Massive Workspace Hero */}
        <div className="bg-[#0F1117] border border-white/[0.06] rounded-[32px] p-8 mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 blur-[80px] rounded-full pointer-events-none" />
          
          <div className="flex flex-col md:flex-row gap-8 items-start justify-between relative z-10">
            <div className="flex items-start gap-6">
              <div 
                className="w-24 h-24 rounded-2xl flex items-center justify-center text-4xl font-bold text-white shadow-2xl"
                style={{ backgroundColor: wsColor(activeWorkspace.name) }}
              >
                {activeWorkspace.name.substring(0, 2).toUpperCase()}
              </div>
              <div className="flex flex-col gap-2 mt-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold text-[#F1F3F9] tracking-tight">{activeWorkspace.name}</h1>
                  <span className="px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase bg-purple-500/20 text-purple-400 border border-purple-500/30">
                    {activeWorkspace.plan} Plan
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-[#8892AA]">
                  <span className="capitalize text-[#F1F3F9] font-medium">{activeWorkspace.role}</span>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" /> All systems healthy
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <code className="text-xs font-mono bg-white/[0.04] px-2 py-1 rounded text-[#8892AA] border border-white/[0.06]">
                    ID: {activeWorkspace.id}
                  </code>
                  <button 
                    onClick={handleCopyId}
                    className="p-1.5 hover:bg-white/[0.06] rounded-md transition-colors text-[#8892AA] hover:text-[#F1F3F9]"
                  >
                    {copiedId ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-6 pt-2">
              <div className="flex flex-col items-end">
                <span className="text-2xl font-bold text-[#F1F3F9]">{indexedDocs}</span>
                <span className="text-xs text-[#8892AA] font-medium uppercase tracking-wider">Documents</span>
              </div>
              <div className="w-px h-10 bg-white/[0.08]" />
              <div className="flex flex-col items-end">
                <span className="text-2xl font-bold text-[#F1F3F9]">{formatBytes(storageUsed)}</span>
                <span className="text-xs text-[#8892AA] font-medium uppercase tracking-wider">Storage</span>
              </div>
              <div className="w-px h-10 bg-white/[0.08]" />
              <div className="flex flex-col items-end">
                <span className="text-2xl font-bold text-[#F1F3F9]">{queries}</span>
                <span className="text-xs text-[#8892AA] font-medium uppercase tracking-wider">AI Queries</span>
              </div>
            </div>
          </div>
        </div>

        {/* Vercel-Style Tabbed Navigation */}
        <div className="border-b border-white/[0.06] mb-8 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-8 min-w-max px-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 pb-4 text-sm font-medium transition-colors relative
                  ${activeTab === tab.id ? 'text-[#F1F3F9]' : 'text-[#8892AA] hover:text-[#F1F3F9]'}
                `}
              >
                <tab.icon size={16} />
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div 
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500 rounded-t-full shadow-[0_0_10px_rgba(168,85,247,0.5)]"
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Workspace Switcher */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-[#F1F3F9]">Your Workspaces</h2>
                    <button 
                      onClick={() => setCreateOpen(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[#F1F3F9] hover:bg-white/[0.08] transition-colors text-sm font-medium"
                    >
                      <Plus size={16} /> New Workspace
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {workspaces.map((ws) => {
                      const isActive = ws.id === activeWorkspace.id;
                      return (
                        <div 
                          key={ws.id}
                          className={`p-5 rounded-2xl border transition-all ${
                            isActive 
                              ? 'bg-purple-500/10 border-purple-500/30' 
                              : 'bg-[#0F1117] border-white/[0.06] hover:border-white/[0.15]'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold text-white"
                                style={{ backgroundColor: wsColor(ws.name) }}
                              >
                                {ws.name.substring(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <h3 className="text-sm font-bold text-[#F1F3F9] flex items-center gap-2">
                                  {ws.name}
                                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Active" />}
                                </h3>
                                <p className="text-[10px] text-[#8892AA] uppercase tracking-wider">{ws.role} • {ws.plan}</p>
                              </div>
                            </div>
                          </div>
                          {!isActive && (
                            <button 
                              onClick={() => setActiveWorkspace(ws)}
                              className="w-full py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-sm font-medium text-[#F1F3F9] transition-colors"
                            >
                              Switch Workspace
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="space-y-6">
                  <h2 className="text-lg font-bold text-[#F1F3F9]">Quick Actions</h2>
                  <div className="flex flex-col gap-3">
                    <button className="flex items-center gap-3 p-4 bg-[#0F1117] border border-white/[0.06] rounded-xl hover:bg-purple-500/10 hover:border-purple-500/30 transition-colors group text-left">
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-purple-500/20 group-hover:text-purple-400 transition-colors">
                        <Users size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#F1F3F9]">Invite Members</p>
                        <p className="text-xs text-[#8892AA]">Add teammates to this workspace</p>
                      </div>
                    </button>
                    <button className="flex items-center gap-3 p-4 bg-[#0F1117] border border-white/[0.06] rounded-xl hover:bg-purple-500/10 hover:border-purple-500/30 transition-colors group text-left">
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-purple-500/20 group-hover:text-purple-400 transition-colors">
                        <Upload size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#F1F3F9]">Upload Documents</p>
                        <p className="text-xs text-[#8892AA]">Add data to vector storage</p>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Premium Empty States for Unimplemented Features */}
            {activeTab === 'members' && (
              <div className="w-full rounded-[32px] border border-white/[0.04] bg-[#0F1117]/50 backdrop-blur-sm p-16 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex items-center justify-center mb-6">
                  <Users size={32} className="text-purple-400" />
                </div>
                <h3 className="text-2xl font-bold text-[#F1F3F9] mb-3">Team Collaboration</h3>
                <p className="text-[#8892AA] max-w-md mb-8">You are currently the only member in this workspace. The team management API is rolling out soon.</p>
                <button className="px-6 py-3 bg-purple-500 text-white font-semibold rounded-xl hover:bg-purple-600 transition-colors">
                  Invite Teammates (Coming Soon)
                </button>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="w-full rounded-[32px] border border-white/[0.04] bg-[#0F1117]/50 backdrop-blur-sm p-16 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mb-6">
                  <Shield size={32} className="text-emerald-400" />
                </div>
                <h3 className="text-2xl font-bold text-[#F1F3F9] mb-3">Enterprise Security</h3>
                <p className="text-[#8892AA] max-w-md mb-8">Configure SSO, SCIM provisioning, and data residency settings for your workspace.</p>
                <button className="px-6 py-3 bg-white/[0.04] border border-white/[0.08] text-white font-semibold rounded-xl hover:bg-white/[0.08] transition-colors">
                  Configure SAML (Enterprise Plan)
                </button>
              </div>
            )}

            {['roles', 'api', 'audit', 'integrations', 'usage'].includes(activeTab) && (
              <div className="w-full rounded-[32px] border border-white/[0.04] bg-[#0F1117]/50 backdrop-blur-sm p-16 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center mb-6">
                  <HardDrive size={32} className="text-blue-400" />
                </div>
                <h3 className="text-2xl font-bold text-[#F1F3F9] mb-3 capitalize">{activeTab.replace('-', ' ')} Settings</h3>
                <p className="text-[#8892AA] max-w-md mb-8">This module is currently initializing in your workspace environment. Check back soon for detailed controls.</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <CreateWorkspaceModal 
        open={createOpen} 
        onClose={() => setCreateOpen(false)} 
      />
    </div>
  );
}
