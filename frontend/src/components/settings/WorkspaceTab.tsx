'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building2, Users, Shield, Key, History, Puzzle, Activity, 
  Copy, Plus, Settings, Upload, MessageSquare, Database, FileText, CheckCircle2,
  Lock, AlertTriangle, Fingerprint, HardDrive
} from 'lucide-react';

import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useDocuments } from '@/hooks/useDocuments';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { CreateWorkspaceModal } from '@/components/workspace/CreateWorkspaceModal';
import { EmptyState } from '@/components/ds/EmptyState';
import { formatBytes } from '@/lib/format';
import { MemberList } from '@/components/settings/members/MemberList';
import { AddMemberForm } from '@/components/settings/members/AddMemberForm';
import { RolePermissionsMatrix } from '@/components/settings/members/RolePermissionsMatrix';

const TABS = [
  { id: 'overview', label: 'Overview', icon: Building2 },
  { id: 'members', label: 'Members', icon: Users },
  { id: 'roles', label: 'Roles & Permissions', icon: Shield },
  { id: 'security', label: 'Security', icon: Lock },
  { id: 'api', label: 'API Keys', icon: Key },
  { id: 'audit', label: 'Audit Logs', icon: History },
  { id: 'integrations', label: 'Integrations', icon: Puzzle },
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


export function WorkspaceTab() {
  const { activeWorkspace, workspaces, setActiveWorkspace } = useWorkspace();
  const { data: documents } = useDocuments();
  const { devDashboard, answerMetrics } = useDashboardMetrics();
  
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
  const storageUsed = devDashboard.data?.totalStorageBytes ?? null;
  const queries = answerMetrics.data?.conversationsCreated ?? 0;

  if (!activeWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <EmptyState
          icon={<Building2 size={24} />}
          title="No Workspace Selected"
          description="Create or select a workspace to manage settings, members, and API keys."
          action={
            <button 
              onClick={() => setCreateOpen(true)}
              className="px-4 py-2 rounded-xl bg-purple-500 text-white font-semibold text-sm hover:bg-purple-600 transition-colors shadow-[0_0_15px_rgba(168,85,247,0.4)]"
            >
              Create Workspace
            </button>
          }
        />
        <CreateWorkspaceModal open={createOpen} onClose={() => setCreateOpen(false)} />
      </div>
    );
  }

  return (
    <div className="flex flex-col animate-in fade-in duration-500">
      
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#F1F3F9] tracking-tight">Workspace Settings</h1>
          <p className="text-sm text-[#8892AA] mt-1">Manage tenants, members, and security for {activeWorkspace.name}</p>
        </div>
      </div>

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
              <span className="text-2xl font-bold text-[#F1F3F9]">
                {storageUsed != null ? formatBytes(storageUsed) : '—'}
              </span>
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
                  layoutId="activeTabWorkspace"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500 rounded-t-full shadow-[0_0_10px_rgba(168,85,247,0.5)]"
                />
              )}
            </button>
          ))}
        </div>
      </div>

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
                  <button className="flex items-center gap-3 p-4 bg-[#0F1117] border border-white/[0.06] rounded-xl hover:bg-purple-500/10 hover:border-purple-500/30 transition-colors group text-left">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-purple-500/20 group-hover:text-purple-400 transition-colors">
                      <Settings size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#F1F3F9]">Workspace Settings</p>
                      <p className="text-xs text-[#8892AA]">Manage roles and limits</p>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'members' && (
            <div className="space-y-6">
              {activeWorkspace.role === 'owner' && <AddMemberForm />}
              <MemberList />
            </div>
          )}

          {activeTab === 'roles' && (
            <RolePermissionsMatrix />
          )}

          {/* Placeholder for not-yet-implemented tabs */}
          {activeTab !== 'overview' && activeTab !== 'members' && activeTab !== 'roles' && (
            <div className="flex flex-col items-center justify-center py-20 bg-[#0F1117] border border-white/[0.06] rounded-2xl">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-center mb-6">
                <AlertTriangle size={24} className="text-[#4A5168]" />
              </div>
              <h2 className="text-lg font-bold text-[#F1F3F9] mb-2 capitalize">{activeTab} Initializing</h2>
              <p className="text-sm text-[#8892AA] max-w-sm text-center">
                The {activeTab} module is currently being provisioned for your workspace.
              </p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <CreateWorkspaceModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
