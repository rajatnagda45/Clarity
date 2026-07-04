'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Plus, Trash2, Heart, Copy, CheckCircle2, AlertCircle, Search } from 'lucide-react';
import { usePromptLibrary, useCreatePromptEntry, useUpdatePromptEntry, useDeletePromptEntry } from '@/hooks/useEnterprise';
import { useToast } from '@/contexts/ToastContext';
import type { PromptLibraryEntry } from '@/types/clarity';

const CATEGORIES = ['general', 'analysis', 'summarization', 'extraction', 'coding', 'writing', 'qa'];

const CATEGORY_COLORS: Record<string, string> = {
  general: 'bg-slate-500/15 text-slate-400',
  analysis: 'bg-blue-500/15 text-blue-400',
  summarization: 'bg-purple-500/15 text-purple-400',
  extraction: 'bg-cyan-500/15 text-cyan-400',
  coding: 'bg-emerald-500/15 text-emerald-400',
  writing: 'bg-amber-500/15 text-amber-400',
  qa: 'bg-rose-500/15 text-rose-400',
};

function CreatePromptModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const create = useCreatePromptEntry();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('general');

  const handleCreate = () => {
    if (!title.trim()) { toast.error('Title is required.'); return; }
    if (!content.trim()) { toast.error('Prompt content is required.'); return; }
    const variables = [...content.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]);
    create.mutate(
      { title: title.trim(), content: content.trim(), category, variables },
      {
        onSuccess: () => { toast.success('Prompt saved.'); onClose(); },
        onError: () => toast.error('Failed to save prompt.'),
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        className="bg-[#0F1117] border border-white/[0.1] rounded-2xl p-6 w-full max-w-lg shadow-2xl"
      >
        <h2 className="text-base font-bold text-[#F1F3F9] mb-5">New Prompt</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#8892AA] mb-1.5">Title *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Summarize technical document"
              className="w-full bg-[#151923] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-[#F1F3F9] placeholder:text-[#4A5168] focus:outline-none focus:border-purple-500/50 transition-colors"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[#8892AA]">Prompt Content *</label>
              <span className="text-[10px] text-[#4A5168]">Use {'{{variable}}'} for placeholders</span>
            </div>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Write your prompt here. Use {{topic}} or {{document}} for dynamic variables…"
              rows={6}
              className="w-full bg-[#151923] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-[#F1F3F9] placeholder:text-[#4A5168] focus:outline-none focus:border-purple-500/50 transition-colors resize-none font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#8892AA] mb-1.5">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(c => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-colors border ${
                    category === c
                      ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                      : 'bg-white/[0.03] text-[#4A5168] border-white/[0.06] hover:text-[#F1F3F9]'
                  }`}
                >
                  {c}
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
            disabled={create.isPending}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50 transition-colors"
          >
            {create.isPending ? 'Saving…' : 'Save Prompt'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function PromptCard({ prompt }: { prompt: PromptLibraryEntry }) {
  const { toast } = useToast();
  const update = useUpdatePromptEntry();
  const remove = useDeletePromptEntry();
  const [copied, setCopied] = useState(false);
  const categoryColor = CATEGORY_COLORS[prompt.category] ?? 'bg-slate-500/15 text-slate-400';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(prompt.content);
    setCopied(true);
    toast.success('Prompt copied to clipboard.');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFavorite = () => {
    update.mutate({ promptId: prompt.id, payload: { is_favorite: !prompt.isFavorite } });
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-4 hover:border-white/[0.1] transition-all duration-200 group"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#F1F3F9] truncate">{prompt.title}</p>
          <span className={`inline-block text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mt-1 ${categoryColor}`}>
            {prompt.category}
          </span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleFavorite}
            className={`p-1.5 rounded-lg transition-colors ${prompt.isFavorite ? 'text-pink-400' : 'text-[#4A5168] hover:text-pink-400'}`}
          >
            <Heart size={13} fill={prompt.isFavorite ? 'currentColor' : 'none'} />
          </button>
          <button
            onClick={handleCopy}
            className={`p-1.5 rounded-lg transition-colors ${copied ? 'text-emerald-400' : 'text-[#4A5168] hover:text-[#F1F3F9]'}`}
          >
            {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
          </button>
          <button
            onClick={() => remove.mutate(prompt.id, {
              onSuccess: () => toast.success('Prompt deleted.'),
              onError: () => toast.error('Failed to delete.'),
            })}
            className="p-1.5 rounded-lg text-[#4A5168] hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      <p className="text-xs text-[#4A5168] font-mono leading-relaxed line-clamp-3">{prompt.content}</p>
      {prompt.variables.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {prompt.variables.map(v => (
            <span key={v} className="text-[9px] font-mono font-bold text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded-md">
              {'{{'}{v}{'}}'}
            </span>
          ))}
        </div>
      )}
      <div className="mt-3 pt-2 border-t border-white/[0.03] flex items-center justify-between text-[10px] text-[#4A5168]">
        <span>Used {prompt.useCount}×</span>
        {prompt.isFavorite && <Heart size={10} className="text-pink-400" fill="currentColor" />}
      </div>
    </motion.div>
  );
}

export function PromptLibraryTab() {
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading, isError } = usePromptLibrary({
    category: selectedCategory || undefined,
    favoritesOnly,
  });

  const prompts = (data?.prompts ?? []).filter(p =>
    !search.trim() ||
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.content.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col animate-in fade-in duration-500 max-w-5xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <BookOpen size={22} className="text-purple-400" />
            Prompt Library
          </h1>
          <p className="text-sm text-[#8892AA] mt-1">Reusable prompts with variable placeholders shared across your workspace.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-xl text-sm font-semibold hover:bg-slate-100 transition-colors shrink-0"
        >
          <Plus size={16} />
          New Prompt
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A5168]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search prompts…"
            className="bg-[#0F1117] border border-white/[0.08] rounded-xl pl-8 pr-3 py-2 text-sm text-[#F1F3F9] placeholder:text-[#4A5168] focus:outline-none focus:border-purple-500/50 transition-colors w-48"
          />
        </div>
        <button
          onClick={() => { setSelectedCategory(''); setFavoritesOnly(false); }}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors border ${
            !selectedCategory && !favoritesOnly
              ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
              : 'bg-white/[0.03] text-[#4A5168] border-white/[0.06] hover:text-[#F1F3F9]'
          }`}
        >
          All
        </button>
        <button
          onClick={() => { setFavoritesOnly(v => !v); setSelectedCategory(''); }}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors border flex items-center gap-1.5 ${
            favoritesOnly
              ? 'bg-pink-500/20 text-pink-400 border-pink-500/30'
              : 'bg-white/[0.03] text-[#4A5168] border-white/[0.06] hover:text-[#F1F3F9]'
          }`}
        >
          <Heart size={11} fill={favoritesOnly ? 'currentColor' : 'none'} />
          Favorites
        </button>
        {CATEGORIES.map(c => (
          <button
            key={c}
            onClick={() => { setSelectedCategory(c === selectedCategory ? '' : c); setFavoritesOnly(false); }}
            className={`px-4 py-2 rounded-xl text-xs font-semibold capitalize transition-colors border ${
              selectedCategory === c
                ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                : 'bg-white/[0.03] text-[#4A5168] border-white/[0.06] hover:text-[#F1F3F9]'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-36 bg-white/[0.03] border border-white/[0.04] rounded-2xl animate-pulse" />)}
        </div>
      )}

      {isError && (
        <div className="flex items-center justify-center gap-3 py-12 bg-[#0F1117] border border-white/[0.06] rounded-2xl">
          <AlertCircle size={18} className="text-red-400" />
          <p className="text-sm text-red-400">Failed to load prompts.</p>
        </div>
      )}

      {!isLoading && !isError && prompts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 bg-[#0F1117] border border-white/[0.06] rounded-2xl text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.04] flex items-center justify-center mb-4">
            <BookOpen size={24} className="text-[#4A5168]" />
          </div>
          <p className="text-base font-semibold text-[#F1F3F9] mb-1">
            {search || selectedCategory || favoritesOnly ? 'No prompts match your filters' : 'No prompts yet'}
          </p>
          <p className="text-sm text-[#4A5168] mb-6 max-w-sm">
            Save reusable prompt templates with {'{{variable}}'} placeholders to share across your team.
          </p>
          {!search && !selectedCategory && !favoritesOnly && (
            <button
              onClick={() => setShowCreate(true)}
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              Create your first prompt
            </button>
          )}
        </div>
      )}

      {!isLoading && !isError && prompts.length > 0 && (
        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {prompts.map(p => <PromptCard key={p.id} prompt={p} />)}
          </AnimatePresence>
        </motion.div>
      )}

      <AnimatePresence>
        {showCreate && <CreatePromptModal onClose={() => setShowCreate(false)} />}
      </AnimatePresence>
    </div>
  );
}
