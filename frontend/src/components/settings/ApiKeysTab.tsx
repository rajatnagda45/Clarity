'use client';

import { Key, Plus, AlertCircle, Copy, Trash2, Calendar, Shield } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/contexts/ToastContext';

export function ApiKeysTab() {
  const { toast } = useToast();
  
  // Since we don't have a backend endpoint yet, we start empty
  const [keys] = useState<any[]>([]);

  const handleCreateKey = () => {
    toast.info('Developer API access is currently in private beta.');
  };

  return (
    <div className="flex flex-col animate-in fade-in duration-500 max-w-5xl">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">API Keys</h1>
          <p className="text-sm text-[#8892AA] mt-1">Manage your developer credentials for programmatic access to Clarity.</p>
        </div>
        <button 
          onClick={handleCreateKey}
          className="bg-white text-black hover:bg-slate-200 px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
        >
          <Plus size={16} />
          Create New Key
        </button>
      </div>

      <div className="bg-[#0F1117] border border-white/[0.08] rounded-2xl overflow-hidden">
        {keys.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.04] bg-white/[0.02]">
                  <th className="px-6 py-4 text-[10px] font-bold text-[#8892AA] uppercase tracking-wider">Key Name</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#8892AA] uppercase tracking-wider">Key</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#8892AA] uppercase tracking-wider">Permissions</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#8892AA] uppercase tracking-wider">Last Used</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#8892AA] uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {/* When data is available, map through it here */}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-white/[0.02] border border-white/[0.04] flex items-center justify-center mb-6">
              <Key size={32} className="text-[#4A5168]" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">No API Keys Generated</h3>
            <p className="text-sm text-[#8892AA] max-w-md mx-auto mb-8">
              Create an API key to access Clarity programmatically. Keys provide full access to your workspace documents and AI features.
            </p>
            <button 
              onClick={handleCreateKey}
              className="bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              Generate your first key
            </button>
          </div>
        )}
      </div>

      <div className="mt-8 p-6 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex gap-4">
        <AlertCircle size={20} className="text-blue-400 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-semibold text-blue-400 mb-1">Secret Key Security</h3>
          <p className="text-xs text-[#F1F3F9] leading-relaxed max-w-2xl">
            API keys carry the same privileges as your user account. Do not share your API keys in publicly accessible areas such as GitHub, client-side code, and so forth. We automatically scan public repositories for exposed keys and will revoke them immediately.
          </p>
        </div>
      </div>
    </div>
  );
}
