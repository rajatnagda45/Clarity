'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bookmark, Plus, Trash2, ExternalLink, FileSearch } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

const STORAGE_KEY = 'clarity_saved_views_v1';

interface SavedView {
  id: string;
  name: string;
  description: string;
  path: string;
  params: Record<string, string>;
  createdAt: string;
}

function useSavedViews() {
  const [views, setViews] = useState<SavedView[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setViews(JSON.parse(raw));
    } catch {
      setViews([]);
    }
  }, []);

  const save = (views: SavedView[]) => {
    setViews(views);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
  };

  const addView = (view: Omit<SavedView, 'id' | 'createdAt'>) => {
    const next = [...views, { ...view, id: crypto.randomUUID(), createdAt: new Date().toISOString() }];
    save(next);
  };

  const removeView = (id: string) => {
    save(views.filter(v => v.id !== id));
  };

  return { views, addView, removeView };
}

const PAGE_OPTIONS = [
  { label: 'Document Search', path: '/documents', params: {} },
  { label: 'Evaluations', path: '/evaluations', params: {} },
  { label: 'Benchmarks', path: '/benchmarks', params: {} },
  { label: 'Conversations', path: '/conversations', params: {} },
  { label: 'Collections', path: '/collections', params: {} },
];

function CreateViewModal({ onClose, onAdd }: { onClose: () => void; onAdd: (v: Omit<SavedView, 'id' | 'createdAt'>) => void }) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPath, setSelectedPath] = useState('');

  const handleCreate = () => {
    if (!name.trim()) { toast.error('Name is required.'); return; }
    if (!selectedPath) { toast.error('Select a page.'); return; }
    onAdd({ name: name.trim(), description: description.trim(), path: selectedPath, params: {} });
    toast.success('View saved.');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        className="bg-[#0F1117] border border-white/[0.1] rounded-2xl p-6 w-full max-w-md shadow-2xl"
      >
        <h2 className="text-base font-bold text-[#F1F3F9] mb-5">Save View</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#8892AA] mb-1.5">View Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Q2 Eval Results"
              className="w-full bg-[#151923] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-[#F1F3F9] placeholder:text-[#4A5168] focus:outline-none focus:border-purple-500/50 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#8892AA] mb-1.5">Description</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional note"
              className="w-full bg-[#151923] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-[#F1F3F9] placeholder:text-[#4A5168] focus:outline-none focus:border-purple-500/50 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#8892AA] mb-1.5">Page *</label>
            <div className="grid grid-cols-1 gap-1.5">
              {PAGE_OPTIONS.map(p => (
                <button
                  key={p.path}
                  onClick={() => setSelectedPath(p.path)}
                  className={`text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${
                    selectedPath === p.path
                      ? 'bg-purple-500/15 border-purple-500/30 text-purple-300'
                      : 'bg-white/[0.02] border-white/[0.06] text-[#4A5168] hover:text-[#8892AA]'
                  }`}
                >
                  {p.label}
                  <span className="ml-2 font-mono text-[10px] opacity-50">{p.path}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#8892AA] bg-white/[0.04] hover:bg-white/[0.08] transition-colors">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-colors"
          >
            Save View
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export function SavedViewsTab() {
  const { views, addView, removeView } = useSavedViews();
  const [showCreate, setShowCreate] = useState(false);
  const { toast } = useToast();

  const handleNavigate = (view: SavedView) => {
    toast.info(`Navigating to ${view.name}…`);
    window.location.href = view.path;
  };

  return (
    <div className="flex flex-col animate-in fade-in duration-500 max-w-4xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Bookmark size={22} className="text-purple-400" />
            Saved Views
          </h1>
          <p className="text-sm text-[#8892AA] mt-1">Bookmark pages and search states for quick access. Stored locally in your browser.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-xl text-sm font-semibold hover:bg-slate-100 transition-colors shrink-0"
        >
          <Plus size={16} />
          Save View
        </button>
      </div>

      {views.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-[#0F1117] border border-white/[0.06] rounded-2xl text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.04] flex items-center justify-center mb-4">
            <Bookmark size={24} className="text-[#4A5168]" />
          </div>
          <p className="text-base font-semibold text-[#F1F3F9] mb-1">No saved views</p>
          <p className="text-sm text-[#4A5168] mb-6 max-w-sm">
            Save shortcuts to frequently visited pages to jump back quickly without re-navigating.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            Create your first view
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence mode="popLayout">
            {views.map(view => (
              <motion.div
                key={view.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="group bg-[#0F1117] border border-white/[0.06] rounded-2xl p-4 hover:border-white/[0.1] transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <FileSearch size={14} className="text-purple-400 shrink-0" />
                      <p className="text-sm font-semibold text-[#F1F3F9] truncate">{view.name}</p>
                    </div>
                    {view.description && (
                      <p className="text-xs text-[#4A5168] mb-2">{view.description}</p>
                    )}
                    <code className="text-[10px] font-mono text-[#4A5168] bg-white/[0.04] px-2 py-0.5 rounded-md">{view.path}</code>
                  </div>
                  <button
                    onClick={() => removeView(view.id)}
                    className="p-1.5 rounded-lg text-[#4A5168] hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="mt-3 pt-3 border-t border-white/[0.04] flex items-center justify-between">
                  <span className="text-[10px] text-[#4A5168]">
                    Saved {new Date(view.createdAt).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => handleNavigate(view)}
                    className="flex items-center gap-1 text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    Open
                    <ExternalLink size={11} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <div className="mt-6 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
        <p className="text-xs text-[#4A5168]">
          Saved views are stored in your browser&apos;s local storage and are private to your browser session.
          They will persist until you clear your browser data or manually delete them.
        </p>
      </div>

      <AnimatePresence>
        {showCreate && <CreateViewModal onClose={() => setShowCreate(false)} onAdd={addView} />}
      </AnimatePresence>
    </div>
  );
}
