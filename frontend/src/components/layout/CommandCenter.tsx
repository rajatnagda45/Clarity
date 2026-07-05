'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, FileText, MessageSquare, Settings, CreditCard, 
  Building2, Users, LayoutDashboard, Database, BarChart2,
  Sparkles, Terminal, FileCode2, ArrowRight
} from 'lucide-react';
import { useCommand } from '@/contexts/CommandContext';
import { useDocuments } from '@/hooks/useDocuments';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  category: 'Pages' | 'Quick Actions' | 'AI Commands' | 'Documents' | 'Workspaces';
  icon: any;
  action: () => void;
}

export function CommandCenter() {
  const { isOpen, setIsOpen } = useCommand();
  const router = useRouter();
  const { data: documents = [] } = useDocuments();
  const { workspaces, setActiveWorkspace } = useWorkspace();
  
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleAction = useCallback((result: SearchResult) => {
    result.action();
    setIsOpen(false);
  }, [setIsOpen]);

  // Compile Static Results
  const STATIC_RESULTS: SearchResult[] = [
    // Pages
    { id: 'p1', title: 'Dashboard', subtitle: 'View pipeline and metrics', category: 'Pages', icon: LayoutDashboard, action: () => router.push('/dashboard') },
    { id: 'p2', title: 'Documents', subtitle: 'Manage knowledge base', category: 'Pages', icon: FileText, action: () => router.push('/documents') },
    { id: 'p3', title: 'AI Chat', subtitle: 'Chat with your documents', category: 'Pages', icon: MessageSquare, action: () => router.push('/chat') },
    { id: 'p4', title: 'Analytics', subtitle: 'Observe RAG performance', category: 'Pages', icon: BarChart2, action: () => router.push('/eval') },
    { id: 'p5', title: 'Settings', subtitle: 'Manage preferences and profile', category: 'Pages', icon: Settings, action: () => router.push('/settings') },
    
    // Quick Actions
    { id: 'q1', title: 'Upload Document', subtitle: 'Add a new file to vector storage', category: 'Quick Actions', icon: Database, action: () => router.push('/documents') },
    { id: 'q2', title: 'New Conversation', subtitle: 'Start a new AI chat', category: 'Quick Actions', icon: MessageSquare, action: () => router.push('/chat') },
    
    // AI Commands (Routes to Chat with pre-filled prompt)
    { id: 'ai1', title: 'Summarize latest contract', subtitle: 'AI will process recent documents', category: 'AI Commands', icon: Sparkles, action: () => router.push('/chat?q=Summarize+the+latest+contract') },
    { id: 'ai2', title: 'Find all NDAs', subtitle: 'AI will search for non-disclosure agreements', category: 'AI Commands', icon: Sparkles, action: () => router.push('/chat?q=Find+all+NDAs') },
  ];

  // Dynamic Results
  const dynamicWorkspaces: SearchResult[] = workspaces.map(ws => ({
    id: `ws-${ws.id}`,
    title: `Switch to ${ws.name}`,
    subtitle: `${ws.role} • ${ws.plan} plan`,
    category: 'Workspaces',
    icon: Building2,
    action: () => setActiveWorkspace(ws)
  }));

  const dynamicDocuments: SearchResult[] = documents.map(doc => ({
    id: `doc-${doc.id}`,
    title: doc.filename,
    subtitle: `Uploaded on ${new Date(doc.createdAt).toLocaleDateString()}`,
    category: 'Documents',
    icon: FileCode2,
    action: () => router.push('/documents')
  }));

  // Filtering
  const allResults = [...STATIC_RESULTS, ...dynamicWorkspaces, ...dynamicDocuments];
  
  const filteredResults = allResults.filter(r => {
    if (!query) return r.category !== 'Documents'; // Don't show all documents when empty
    const q = query.toLowerCase();
    return r.title.toLowerCase().includes(q) || r.subtitle.toLowerCase().includes(q) || r.category.toLowerCase().includes(q);
  }).slice(0, 8); // Max 8 results

  // Group by category
  const groupedResults = filteredResults.reduce((acc, result) => {
    if (!acc[result.category]) acc[result.category] = [];
    acc[result.category].push(result);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  // Keyboard Nav
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredResults.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredResults.length) % filteredResults.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredResults[selectedIndex]) {
          handleAction(filteredResults[selectedIndex]);
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredResults, selectedIndex, handleAction]);

  // Reset index on query change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={() => setIsOpen(false)}
          className="absolute inset-0 bg-[#05070B]/60 backdrop-blur-[4px]"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: -10 }}
          transition={{ type: "spring", duration: 0.4, bounce: 0 }}
          className="relative w-full max-w-2xl bg-[#0F1117]/80 backdrop-blur-[32px] border border-white/[0.08] rounded-[24px] shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8),0_0_40px_rgba(168,85,247,0.1)] overflow-hidden flex flex-col"
        >
          {/* Input */}
          <div className="relative flex items-center px-4 border-b border-white/[0.06]">
            <Search size={20} className="text-[#8892AA] absolute left-6" />
            <input 
              ref={inputRef}
              type="text"
              placeholder="Search workspaces, documents, pages, or run AI commands..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-transparent border-none py-6 pl-12 pr-4 text-[17px] text-[#F1F3F9] placeholder:text-[#4A5168] focus:outline-none focus:ring-0"
            />
            {query && (
              <button 
                onClick={() => setQuery('')}
                className="absolute right-6 text-[10px] font-bold uppercase tracking-wider text-[#4A5168] bg-white/[0.04] px-2 py-1 rounded hover:bg-white/[0.08] hover:text-[#F1F3F9] transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto max-h-[50vh] p-2 scrollbar-hide">
            {filteredResults.length === 0 ? (
              <div className="px-6 py-12 text-center flex flex-col items-center">
                <div className="w-12 h-12 rounded-2xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-center mb-4">
                  <Terminal size={20} className="text-[#4A5168]" />
                </div>
                <h3 className="text-[#F1F3F9] font-semibold">No results found</h3>
                <p className="text-[#4A5168] text-sm mt-1">Try searching for documents or running an AI command</p>
              </div>
            ) : (
              <div className="flex">
                {/* Left: Search Results list */}
                <div className="flex-1 space-y-4 px-2 py-2">
                  {Object.entries(groupedResults).map(([category, items]) => (
                    <div key={category}>
                      <h4 className="px-3 text-[10px] font-bold uppercase tracking-wider text-[#4A5168] mb-2">{category}</h4>
                      <div className="space-y-1">
                        {items.map((item) => {
                          const index = filteredResults.indexOf(item);
                          const isSelected = index === selectedIndex;
                          return (
                            <button
                              key={item.id}
                              onClick={() => handleAction(item)}
                              onMouseEnter={() => setSelectedIndex(index)}
                              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl text-left transition-colors relative group
                                ${isSelected ? 'bg-white/[0.06]' : 'hover:bg-white/[0.02]'}
                              `}
                            >
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors
                                ${isSelected ? 'bg-purple-500/20 text-purple-400' : 'bg-white/[0.04] text-[#8892AA] group-hover:bg-purple-500/10 group-hover:text-purple-400'}
                              `}>
                                <item.icon size={16} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className={`text-sm font-semibold truncate ${isSelected ? 'text-[#F1F3F9]' : 'text-[#8892AA] group-hover:text-[#F1F3F9]'}`}>{item.title}</h3>
                                <p className="text-[11px] text-[#4A5168] truncate mt-0.5">{item.subtitle}</p>
                              </div>
                              {isSelected && (
                                <ArrowRight size={14} className="text-purple-400 animate-in fade-in" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Right: Preview Panel (Only shows on desktop if there's a selected item) */}
                <div className="hidden sm:block w-[280px] border-l border-white/[0.06] p-6 bg-white/[0.01]">
                  {filteredResults[selectedIndex] && (
                    <div className="animate-in fade-in duration-200">
                      <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4">
                        {(() => {
                          const Icon = filteredResults[selectedIndex].icon;
                          return <Icon size={24} className="text-purple-400" />;
                        })()}
                      </div>
                      <h3 className="text-base font-bold text-[#F1F3F9] mb-1 leading-tight">{filteredResults[selectedIndex].title}</h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-white/[0.06] text-[#8892AA] mb-4 inline-block">
                        {filteredResults[selectedIndex].category}
                      </span>
                      <p className="text-xs text-[#8892AA] mb-6">{filteredResults[selectedIndex].subtitle}</p>
                      
                      <div className="space-y-2 pt-4 border-t border-white/[0.06]">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-[#4A5168]">Action</span>
                          <span className="text-[#F1F3F9] font-medium">Open</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-[#4A5168]">Shortcut</span>
                          <span className="text-[#F1F3F9] font-medium bg-white/[0.06] px-1.5 rounded">↵</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-white/[0.06] bg-[#05070B] px-4 py-3 flex items-center gap-4 text-[11px] text-[#4A5168]">
            <div className="flex items-center gap-1.5">
              <span className="bg-white/[0.06] px-1.5 py-0.5 rounded border border-white/[0.04]">↑</span>
              <span className="bg-white/[0.06] px-1.5 py-0.5 rounded border border-white/[0.04]">↓</span>
              <span>Navigate</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="bg-white/[0.06] px-1.5 py-0.5 rounded border border-white/[0.04]">↵</span>
              <span>Execute</span>
            </div>
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="bg-white/[0.06] px-1.5 py-0.5 rounded border border-white/[0.04]">esc</span>
              <span>Close</span>
            </div>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
