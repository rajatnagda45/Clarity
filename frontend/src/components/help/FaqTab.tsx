'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, ChevronDown, ChevronUp, Search } from 'lucide-react';

const FAQS = [
  {
    category: 'Billing & Subscriptions',
    questions: [
      { q: 'How do you charge for vector storage?', a: 'Storage is calculated based on the total number of bytes your documents consume after they are chunked and embedded. Starter plans include 50MB of vector storage, which is roughly equivalent to 10,000 pages of text.' },
      { q: 'Can I cancel my subscription at any time?', a: 'Yes, you can cancel your subscription at any time from the Billing page in your Workspace Settings. Your plan will remain active until the end of your current billing cycle.' },
    ]
  },
  {
    category: 'AI & Data Privacy',
    questions: [
      { q: 'Are my documents used to train your models?', a: 'No. Clarity maintains a strict zero-retention policy with our LLM providers. Your data is used exclusively for your workspace queries and is never used to train foundational models.' },
      { q: 'Where is my vector data stored?', a: 'Vector embeddings are stored in isolated, encrypted Pinecone indexes located in AWS us-east-1.' },
    ]
  },
  {
    category: 'Limits & Capabilities',
    questions: [
      { q: 'What is the maximum file size for uploads?', a: 'Currently, the maximum file size is 50MB per document for PDF, TXT, and Markdown files.' },
      { q: 'How many collections can I create?', a: 'Starter plans are limited to 3 collections, Pro plans include 20 collections, and Enterprise plans offer unlimited collections.' },
    ]
  }
];

function FaqItem({ q, a }: { q: string, a: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl overflow-hidden mb-3">
      <button 
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-5 bg-white/[0.01] hover:bg-white/[0.03] transition-colors text-left"
      >
        <span className="font-semibold text-[#F1F3F9] pr-4">{q}</span>
        <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors ${expanded ? 'bg-purple-500/20 text-purple-400' : 'bg-white/[0.04] text-[#8892AA]'}`}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-5 pt-0 border-t border-white/[0.04]">
              <p className="text-[#8892AA] leading-relaxed mt-4">{a}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FaqTab() {
  const [search, setSearch] = useState('');

  return (
    <div className="flex flex-col animate-in fade-in duration-500 max-w-3xl">
      
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#F1F3F9] tracking-tight flex items-center gap-3">
            <Info className="text-purple-400" size={28} />
            Frequently Asked Questions
          </h1>
          <p className="text-[#8892AA] mt-2 text-lg">Quick answers to common questions about Clarity.</p>
        </div>
      </div>

      <div className="relative mb-10">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4A5168]" />
        <input 
          type="text" 
          placeholder="Search questions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[#0F1117] border border-white/[0.08] rounded-2xl pl-12 pr-4 py-4 text-base text-[#F1F3F9] placeholder:text-[#4A5168] focus:outline-none focus:border-purple-500/50 transition-colors shadow-sm"
        />
      </div>

      <div className="space-y-10">
        {FAQS.map((group) => {
          const filteredQs = group.questions.filter(
            q => q.q.toLowerCase().includes(search.toLowerCase()) || q.a.toLowerCase().includes(search.toLowerCase())
          );
          
          if (filteredQs.length === 0) return null;

          return (
            <div key={group.category}>
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#4A5168] pl-2 mb-4">
                {group.category}
              </h2>
              <div>
                {filteredQs.map((q, i) => (
                  <FaqItem key={i} q={q.q} a={q.a} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
