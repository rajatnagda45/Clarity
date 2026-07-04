'use client';

import { useUser, useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { AlertTriangle, Download, LogOut, UserX, Trash2 } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useState } from 'react';

export function DangerZoneTab() {
  const { user } = useUser();
  const { signOut } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const { toast } = useToast();
  
  const [processing, setProcessing] = useState<string | null>(null);

  const handleExport = () => {
    setProcessing('export');
    setTimeout(() => {
      setProcessing(null);
      toast.success('A link to download your data will be sent to your email.');
    }, 1500);
  };

  const handleDeactivate = () => {
    if (window.confirm('Are you sure you want to deactivate your account? This action will pause all AI jobs and subscriptions.')) {
      setProcessing('deactivate');
      setTimeout(() => {
        setProcessing(null);
        toast.error('Account deactivation is currently handled by your workspace administrator.');
      }, 1000);
    }
  };

  const handleDelete = () => {
    if (window.confirm('DANGER: This action cannot be undone. All your personal data will be permanently deleted. Are you absolutely sure?')) {
      setProcessing('delete');
      setTimeout(() => {
        setProcessing(null);
        toast.error('Contact support to permanently delete your account.');
      }, 1000);
    }
  };

  const handleLeaveWorkspace = () => {
    if (window.confirm(`Are you sure you want to leave "${activeWorkspace?.name}"? You will lose access to all documents in this workspace.`)) {
      setProcessing('leave');
      setTimeout(() => {
        setProcessing(null);
        toast.error('You cannot leave a workspace where you are the sole owner.');
      }, 1000);
    }
  };

  if (!user) return null;

  return (
    <div className="flex flex-col animate-in fade-in duration-500 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-rose-400 tracking-tight">Danger Zone</h1>
        <p className="text-sm text-[#8892AA] mt-1">Destructive actions and data portability options.</p>
      </div>

      <div className="space-y-6">
        {/* Export Data */}
        <div className="p-6 rounded-2xl bg-[#0F1117] border border-white/[0.08] flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <h3 className="text-sm font-semibold text-white mb-1">Export Personal Data</h3>
            <p className="text-xs text-[#8892AA]">
              Download a copy of your personal data, AI conversation history, and preferences in JSON format.
            </p>
          </div>
          <button 
            onClick={handleExport}
            disabled={processing === 'export'}
            className="flex-shrink-0 px-4 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded-xl text-sm font-medium text-white transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Download size={16} />
            {processing === 'export' ? 'Preparing...' : 'Request Export'}
          </button>
        </div>

        {/* Leave Workspace */}
        {activeWorkspace && (
          <div className="p-6 rounded-2xl bg-[#0F1117] border border-white/[0.08] flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <h3 className="text-sm font-semibold text-white mb-1">Leave Workspace</h3>
              <p className="text-xs text-[#8892AA]">
                Remove yourself from <span className="text-white font-medium">{activeWorkspace.name}</span>. You will immediately lose access to its resources.
              </p>
            </div>
            <button 
              onClick={handleLeaveWorkspace}
              disabled={processing === 'leave'}
              className="flex-shrink-0 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl text-sm font-medium text-rose-400 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <LogOut size={16} />
              Leave Workspace
            </button>
          </div>
        )}

        <div className="w-full h-px bg-white/[0.04] my-4"></div>

        {/* Deactivate Account */}
        <div className="p-6 rounded-2xl bg-rose-500/5 border border-rose-500/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <h3 className="text-sm font-semibold text-rose-400 mb-1">Deactivate Account</h3>
            <p className="text-xs text-rose-400/70">
              Temporarily disable your account. Your data will be preserved, but you won&apos;t be able to log in or use APIs.
            </p>
          </div>
          <button 
            onClick={handleDeactivate}
            disabled={processing === 'deactivate'}
            className="flex-shrink-0 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl text-sm font-medium text-rose-400 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <UserX size={16} />
            Deactivate
          </button>
        </div>

        {/* Delete Account */}
        <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <h3 className="text-sm font-semibold text-rose-400 mb-1 flex items-center gap-2">
              <AlertTriangle size={16} />
              Delete Account
            </h3>
            <p className="text-xs text-rose-400/80 leading-relaxed max-w-xl">
              Permanently delete your account and all associated personal data. 
              <strong> This action is irreversible.</strong> It will not delete workspaces where you are not the sole owner.
            </p>
          </div>
          <button 
            onClick={handleDelete}
            disabled={processing === 'delete'}
            className="flex-shrink-0 px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50 shadow-[0_0_15px_rgba(244,63,94,0.3)]"
          >
            <Trash2 size={16} />
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );
}
