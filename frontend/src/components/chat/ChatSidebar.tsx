import { motion } from 'framer-motion';
import { MessageSquare, Plus, Folder, Pin, MoreHorizontal, Search } from 'lucide-react';
import type { Conversation } from '@/types/clarity';
import { formatRelativeTime } from '@/lib/time';

interface ChatSidebarProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
}

export function ChatSidebar({ conversations, selectedId, onSelect, onNewChat }: ChatSidebarProps) {
  return (
    <div className="w-[260px] flex-shrink-0 h-full bg-[#05070B] border-r border-white/[0.04] flex flex-col pt-6">
      <div className="px-4 mb-6">
        <button 
          onClick={onNewChat}
          className="w-full flex items-center justify-between bg-white text-black hover:bg-slate-200 transition-colors rounded-xl px-4 py-2.5 font-medium shadow-[0_0_20px_rgba(255,255,255,0.1)]"
        >
          <span className="flex items-center gap-2">
            <Plus size={16} /> New Chat
          </span>
          <span className="text-xs bg-black/10 px-1.5 rounded text-black/60">⌘K</span>
        </button>
      </div>

      <div className="px-4 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8892AA]" />
          <input 
            type="text" 
            placeholder="Search history..." 
            className="w-full bg-[#0F1117] border border-white/[0.06] rounded-xl pl-9 pr-4 py-2 text-xs text-[#F1F3F9] placeholder:text-[#4A5168] focus:outline-none focus:border-purple-500/50 transition-colors"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4 scrollbar-hide space-y-6">
        
        {/* Stubbed Pinned & Folders to show premium intent without faking data */}
        <div className="px-2">
          <h3 className="text-[10px] uppercase tracking-wider font-bold text-[#4A5168] mb-2 px-2 flex justify-between group cursor-default">
            Pinned <span className="opacity-0 group-hover:opacity-100 text-purple-400">Coming Soon</span>
          </h3>
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-[#4A5168] text-xs">
            <Pin size={12} /> No pinned chats
          </div>
        </div>
        
        <div className="px-2">
          <h3 className="text-[10px] uppercase tracking-wider font-bold text-[#4A5168] mb-2 px-2">Recent</h3>
          <div className="space-y-0.5">
            {conversations.map(conv => {
              const isActive = conv.id === selectedId;
              return (
                <button
                  key={conv.id}
                  onClick={() => onSelect(conv.id)}
                  className={`w-full group flex flex-col gap-1 text-left px-3 py-2.5 rounded-xl transition-all ${
                    isActive 
                      ? 'bg-purple-500/10 text-[#F1F3F9]' 
                      : 'text-[#8892AA] hover:bg-white/[0.04] hover:text-[#F1F3F9]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 w-full">
                    <span className="text-sm font-medium truncate flex-1 flex items-center gap-2">
                      <MessageSquare size={14} className={isActive ? 'text-purple-400' : 'text-[#4A5168]'} />
                      {conv.title || 'New Conversation'}
                    </span>
                    <MoreHorizontal size={14} className={`opacity-0 group-hover:opacity-100 transition-opacity ${isActive ? 'text-purple-400' : 'text-[#4A5168]'}`} />
                  </div>
                  <span className="text-[10px] text-[#4A5168] pl-6 font-medium">
                    {formatRelativeTime(conv.lastMessageAt)}
                  </span>
                </button>
              );
            })}
            
            {conversations.length === 0 && (
              <p className="text-xs text-[#4A5168] px-2 py-2">No history yet.</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
