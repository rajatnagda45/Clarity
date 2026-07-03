import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Building2, Sparkles } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/contexts/ToastContext';
import { createWorkspace } from '@/lib/api';

interface CreateWorkspaceModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateWorkspaceModal({ open, onClose }: CreateWorkspaceModalProps) {
  const { setActiveWorkspace, refresh } = useWorkspace();
  const { getToken } = useAuth();
  const { toast } = useToast();
  
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('No token');
      const ws = await createWorkspace({ token }, { name: name.trim() });
      setActiveWorkspace(ws);
      await refresh();
      toast.success(`Workspace "${ws.name}" created`);
      onClose();
      setName('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create workspace');
    } finally {
      setCreating(false);
    }
  }

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-[#05070B]/80 backdrop-blur-sm"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
          className="relative w-full max-w-lg bg-[#0F1117] border border-white/[0.08] rounded-[24px] shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/[0.04]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                <Building2 size={20} className="text-purple-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#F1F3F9]">New Workspace</h2>
                <p className="text-xs text-[#8892AA]">Create an isolated tenant boundary</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 text-[#4A5168] hover:text-[#F1F3F9] hover:bg-white/[0.04] rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#8892AA] uppercase tracking-wider">Workspace Name</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Acme Corp Engineering"
                className="w-full bg-[#05070B] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-[#F1F3F9] placeholder:text-[#4A5168] focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all"
                autoFocus
              />
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 bg-[#05070B] border-t border-white/[0.04] flex items-center justify-between">
            <p className="text-[11px] text-[#4A5168] flex items-center gap-1.5">
              <Sparkles size={12} className="text-purple-400" />
              This workspace will have its own isolated storage.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={onClose}
                disabled={creating}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-[#8892AA] hover:text-[#F1F3F9] hover:bg-white/[0.04] transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreate}
                disabled={!name.trim() || creating}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-purple-500 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-purple-600 hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all flex items-center gap-2"
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
