'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, LayoutTemplate, Lock, Users, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { useCreateCollection } from '@/hooks/useCollections';
import type { Collection } from '@/types/clarity';

const COLLECTION_COLORS = [
  '#6366f1', '#0ea5e9', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6',
];

interface CreateCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate?: (collection: Collection) => void;
}

export function CreateCollectionModal({ isOpen, onClose, onCreate }: CreateCollectionModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [access, setAccess] = useState<'private' | 'team'>('team');
  const [selectedColor, setSelectedColor] = useState(COLLECTION_COLORS[0]);
  const [error, setError] = useState('');

  const createMutation = useCreateCollection();

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setError('');
    try {
      const collection = await createMutation.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        color: selectedColor,
        icon: access,
      });
      setName('');
      setDescription('');
      setSelectedColor(COLLECTION_COLORS[0]);
      setAccess('team');
      onCreate?.(collection);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create collection.');
    }
  };

  const handleClose = () => {
    if (createMutation.isPending) return;
    setName('');
    setDescription('');
    setError('');
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="absolute inset-0 bg-[#05070B]/80 backdrop-blur-sm"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
          className="relative w-full max-w-lg bg-[#0F1117] border border-white/[0.08] rounded-[24px] shadow-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between p-6 border-b border-white/[0.04]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${selectedColor}20`, border: `1px solid ${selectedColor}40` }}>
                <LayoutTemplate size={20} style={{ color: selectedColor }} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#F1F3F9]">New Knowledge Base</h2>
                <p className="text-xs text-[#8892AA]">Create a focused collection of documents</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              disabled={createMutation.isPending}
              className="p-2 text-[#4A5168] hover:text-[#F1F3F9] hover:bg-white/[0.04] rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-6 space-y-5">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                <AlertCircle size={16} className="shrink-0" /> {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#8892AA] uppercase tracking-wider">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) void handleSubmit(); }}
                placeholder="e.g., HR Policies 2026"
                maxLength={200}
                disabled={createMutation.isPending}
                className="w-full bg-[#05070B] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-[#F1F3F9] placeholder:text-[#4A5168] focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all disabled:opacity-50"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#8892AA] uppercase tracking-wider">Description (Optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What kind of knowledge lives here?"
                rows={2}
                disabled={createMutation.isPending}
                className="w-full bg-[#05070B] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-[#F1F3F9] placeholder:text-[#4A5168] focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all resize-none disabled:opacity-50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#8892AA] uppercase tracking-wider">Color</label>
              <div className="flex gap-2 flex-wrap">
                {COLLECTION_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`w-7 h-7 rounded-full transition-all ${selectedColor === color ? 'ring-2 ring-offset-2 ring-offset-[#05070B] scale-110' : 'hover:scale-105'}`}
                    style={{ backgroundColor: color, outlineColor: color }}
                    aria-label={`Select color ${color}`}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#8892AA] uppercase tracking-wider mb-2 block">Access Level</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setAccess('team')}
                  disabled={createMutation.isPending}
                  className={`flex flex-col items-start p-4 rounded-xl border text-left transition-all disabled:opacity-50 ${
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
                  disabled={createMutation.isPending}
                  className={`flex flex-col items-start p-4 rounded-xl border text-left transition-all disabled:opacity-50 ${
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

          <div className="p-6 bg-[#05070B] border-t border-white/[0.04] flex items-center justify-between">
            <p className="text-[11px] text-[#4A5168] flex items-center gap-1.5">
              <Sparkles size={12} className="text-purple-400" />
              AI will index this collection automatically.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                disabled={createMutation.isPending}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-[#8892AA] hover:text-[#F1F3F9] hover:bg-white/[0.04] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleSubmit()}
                disabled={!name.trim() || createMutation.isPending}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-purple-500 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-purple-600 hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all flex items-center gap-2"
              >
                {createMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                Create
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
