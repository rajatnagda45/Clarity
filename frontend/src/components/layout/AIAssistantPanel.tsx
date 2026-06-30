'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import { X, FileText, Search, Layers, MessageCircle, ArrowRight, BookOpen } from 'lucide-react';
import { usePathname } from 'next/navigation';

const suggestedPrompts = [
  { label: 'Summarize', icon: <FileText size={14} /> },
  { label: 'Find contract clauses', icon: <Search size={14} /> },
  { label: 'Compare documents', icon: <Layers size={14} /> },
  { label: 'Ask a question', icon: <MessageCircle size={14} /> },
];

export function AIAssistantPanel() {
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(true);

  const firstName = user?.firstName ?? 'there';

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    router.push(`/chat?q=${encodeURIComponent(query.trim())}`);
    setQuery('');
  }

  if (!visible) return null;

  return (
    <div className="flex h-full flex-col border-l border-[rgba(255,255,255,0.06)] bg-[#0C0F16] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[#F1F3F9]">AI Assistant</span>
          <span className="rounded bg-[rgba(91,110,240,0.2)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#5B6EF0]">
            BETA
          </span>
        </div>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="rounded-lg p-1 text-[#4A5168] hover:bg-[rgba(255,255,255,0.06)] hover:text-[#8892AA] transition-colors"
          aria-label="Close AI panel"
        >
          <X size={14} />
        </button>
      </div>

      {/* Greeting */}
      <div className="px-4 pb-4">
        <p className="text-sm font-medium text-[#F1F3F9]">Hello, {firstName}!</p>
        <p className="mt-0.5 text-xs text-[#8892AA]">How can I help you today?</p>
      </div>

      {/* Suggested prompts */}
      <div className="px-3 pb-4 flex flex-col gap-2">
        {suggestedPrompts.map((prompt, i) => (
          <motion.div
            key={prompt.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07, duration: 0.2 }}
          >
            <Link
              href="/chat"
              className="flex items-center gap-2 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#151923] p-3 text-sm text-[#8892AA] transition-colors hover:border-[rgba(91,110,240,0.3)] hover:text-[#F1F3F9]"
            >
              <span className="text-[#4A5168]">{prompt.icon}</span>
              {prompt.label}
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Input bar */}
      <div className="px-3 pb-4">
        <form onSubmit={handleSubmit} className="flex items-center gap-2 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#151923] px-3 py-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask anything..."
            className="flex-1 bg-transparent text-sm text-[#F1F3F9] placeholder-[#4A5168] outline-none"
          />
          <button
            type="submit"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#5B6EF0] text-white transition-colors hover:bg-[#6B7EF5]"
            aria-label="Send"
          >
            <ArrowRight size={12} />
          </button>
        </form>
      </div>

      {/* Citations section on dashboard */}
      {pathname === '/dashboard' && (
        <div className="border-t border-[rgba(255,255,255,0.06)] px-4 py-4 flex flex-col gap-3">
          <p className="text-xs font-semibold text-[#8892AA]">Recent Citations</p>
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <BookOpen size={24} className="text-[#4A5168]" />
            <p className="text-xs text-[#8892AA]">Verify a document to see citations</p>
          </div>
          <Link
            href="/chat"
            className="text-center text-xs text-[#5B6EF0] hover:text-[#6B7EF5] transition-colors"
          >
            View all in AI Chat
          </Link>
        </div>
      )}
    </div>
  );
}
