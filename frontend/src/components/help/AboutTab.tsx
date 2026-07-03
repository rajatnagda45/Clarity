'use client';

import { motion } from 'framer-motion';
import { Info, Code, MessageCircle, Map, Book, FileText, Shield, Sparkles } from 'lucide-react';

export function AboutTab() {
  return (
    <div className="flex flex-col animate-in fade-in duration-500 max-w-3xl">
      
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#F1F3F9] tracking-tight flex items-center gap-3">
            <Info className="text-purple-400" size={28} />
            About Clarity
          </h1>
          <p className="text-[#8892AA] mt-2 text-lg">Version information, legal policies, and credits.</p>
        </div>
      </div>

      <div className="bg-[#0F1117] border border-white/[0.06] rounded-[32px] p-10 mb-8 relative overflow-hidden flex flex-col items-center text-center">
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 blur-[80px] rounded-full pointer-events-none" />
        
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#5B6EF0] to-[#8B5CF6] flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(91,110,240,0.4)] relative z-10">
          <svg width="40" height="40" viewBox="0 0 16 16" fill="white">
            <path d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z" />
          </svg>
        </div>
        
        <h2 className="text-2xl font-bold text-[#F1F3F9] relative z-10 mb-1">Clarity Enterprise</h2>
        <p className="text-[#8892AA] font-mono text-sm relative z-10 mb-6">v2.4.0 (Build 9832.1)</p>
        
        <p className="text-[#8892AA] max-w-md relative z-10">
          Clarity is a next-generation vector database platform that helps teams build AI agents, chat with documents, and manage enterprise knowledge securely.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: 'Terms of Service', icon: FileText, href: '#' },
          { label: 'Privacy Policy', icon: Shield, href: '#' },
          { label: 'Documentation', icon: Book, href: '#' },
          { label: 'Public Roadmap', icon: Map, href: '#' },
          { label: 'Open Source Credits', icon: Code, href: '#' },
          { label: 'Follow on Twitter', icon: MessageCircle, href: '#' },
        ].map((item, i) => (
          <motion.a
            key={i}
            href={item.href}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
            className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.08] transition-all text-[#F1F3F9] font-medium"
          >
            <item.icon size={18} className="text-[#4A5168]" />
            {item.label}
          </motion.a>
        ))}
      </div>

      <div className="mt-12 text-center text-sm text-[#4A5168]">
        <p>&copy; {new Date().getFullYear()} Clarity AI, Inc. All rights reserved.</p>
        <p className="mt-1 flex items-center justify-center gap-1">
          Designed with <Sparkles size={12} className="text-purple-400" /> in California
        </p>
      </div>

    </div>
  );
}
