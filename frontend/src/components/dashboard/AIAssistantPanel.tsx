'use client';

import { motion } from 'framer-motion';
import { Sparkles, MessageSquare, ArrowRight, FileText, UploadCloud } from 'lucide-react';
import Link from 'next/link';

export function AIAssistantPanel() {
  const suggestions = [
    { label: "Summarize recent uploads", icon: FileText },
    { label: "Compare document clauses", icon: FileText },
    { label: "Find specific obligations", icon: FileText },
  ];

  return (
    <div className="bg-[#0F1117] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6 shadow-xl relative overflow-hidden group">
      
      {/* Background decoration */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br from-blue-500/20 to-purple-600/20 rounded-full blur-[60px] pointer-events-none group-hover:from-blue-500/30 group-hover:to-purple-600/30 transition-colors duration-700" />
      
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Sparkles size={18} className="text-white" />
          </div>
          <div>
            <h2 className="text-[#F1F3F9] font-bold text-lg tracking-tight">AI Assistant</h2>
            <p className="text-[#8892AA] text-xs">Ready to analyze</p>
          </div>
        </div>

        <Link href="/dashboard/chat">
          <button className="w-full bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.15] text-[#F1F3F9] rounded-xl py-3 px-4 flex items-center justify-between transition-all duration-300 group/btn mb-6 shadow-sm">
            <span className="flex items-center gap-2 font-medium text-sm">
              <MessageSquare size={16} className="text-blue-400" />
              New Conversation
            </span>
            <ArrowRight size={16} className="text-[#8892AA] group-hover/btn:text-white group-hover/btn:translate-x-1 transition-all" />
          </button>
        </Link>

        <div>
          <h3 className="text-[#4A5168] text-xs font-semibold uppercase tracking-wider mb-3">Suggested Prompts</h3>
          <div className="space-y-2">
            {suggestions.map((s, i) => (
              <button 
                key={i}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.04] text-[#8892AA] hover:text-[#F1F3F9] text-sm text-left transition-colors group/item"
              >
                <s.icon size={14} className="text-[#4A5168] group-hover/item:text-purple-400 transition-colors" />
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
