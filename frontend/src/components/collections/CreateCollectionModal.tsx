import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, LayoutTemplate, Lock, Users, Sparkles } from 'lucide-react';

interface CreateCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: () => void;
}

export function CreateCollectionModal({ isOpen, onClose, onCreate }: CreateCollectionModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [access, setAccess] = useState<'private' | 'team'>('team');

  if (!isOpen) return null;

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
                <LayoutTemplate size={20} className="text-purple-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#F1F3F9]">New Knowledge Base</h2>
                <p className="text-xs text-[#8892AA]">Create a focused collection of documents</p>
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
              <label className="text-xs font-semibold text-[#8892AA] uppercase tracking-wider">Name</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., HR Policies 2026"
                className="w-full bg-[#05070B] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-[#F1F3F9] placeholder:text-[#4A5168] focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#8892AA] uppercase tracking-wider">Description (Optional)</label>
              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What kind of knowledge lives here?"
                rows={3}
                className="w-full bg-[#05070B] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-[#F1F3F9] placeholder:text-[#4A5168] focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all resize-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#8892AA] uppercase tracking-wider mb-2 block">Access Level</label>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setAccess('team')}
                  className={`flex flex-col items-start p-4 rounded-xl border text-left transition-all ${
                    access === 'team' 
                      ? 'bg-purple-500/10 border-purple-500/50 text-purple-400' 
                      : 'bg-[#05070B] border-white/[0.08] text-[#8892AA] hover:border-white/[0.2]'
                  }`}
                >
                  <Users size={18} className="mb-2" />
                  <span className={`text-sm font-semibold ${access === 'team' ? 'text-[#F1F3F9]' : ''}`}>Team Access</span>
                  <span className="text-xs mt-1 opacity-70">Anyone in workspace</span>
                </button>
                
                <button 
                  onClick={() => setAccess('private')}
                  className={`flex flex-col items-start p-4 rounded-xl border text-left transition-all ${
                    access === 'private' 
                      ? 'bg-purple-500/10 border-purple-500/50 text-purple-400' 
                      : 'bg-[#05070B] border-white/[0.08] text-[#8892AA] hover:border-white/[0.2]'
                  }`}
                >
                  <Lock size={18} className="mb-2" />
                  <span className={`text-sm font-semibold ${access === 'private' ? 'text-[#F1F3F9]' : ''}`}>Private</span>
                  <span className="text-xs mt-1 opacity-70">Only invited members</span>
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 bg-[#05070B] border-t border-white/[0.04] flex items-center justify-between">
            <p className="text-[11px] text-[#4A5168] flex items-center gap-1.5">
              <Sparkles size={12} className="text-purple-400" />
              AI will index this collection automatically.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-[#8892AA] hover:text-[#F1F3F9] hover:bg-white/[0.04] transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={onCreate}
                disabled={!name.trim()}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-purple-500 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-purple-600 hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all"
              >
                Create
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
