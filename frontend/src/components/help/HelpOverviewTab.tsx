'use client';

import { motion } from 'framer-motion';
import { Search, BookOpen, MessageSquare, AlertTriangle, ListOrdered, ArrowRight } from 'lucide-react';

interface HelpOverviewTabProps {
  onNavigate: (tabId: string) => void;
}

export function HelpOverviewTab({ onNavigate }: HelpOverviewTabProps) {
  return (
    <div className="flex flex-col animate-in fade-in duration-500">
      
      {/* Hero Section */}
      <div className="bg-[#0F1117] border border-white/[0.06] rounded-[32px] p-10 mb-8 relative overflow-hidden shadow-[0_0_40px_rgba(168,85,247,0.05)]">
        <div className="absolute top-[-50%] right-[-10%] w-[120%] h-[200%] bg-[radial-gradient(ellipse_at_center,rgba(168,85,247,0.15)_0%,transparent_70%)] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col items-center text-center max-w-2xl mx-auto py-12">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(168,85,247,0.3)]"
          >
            <BookOpen size={32} className="text-purple-400" />
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl md:text-5xl font-bold text-[#F1F3F9] tracking-tight mb-4"
          >
            How can we help you today?
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-[#8892AA] text-lg mb-10 max-w-lg"
          >
            Search our knowledge base, explore interactive guides, or get in touch with our support team.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="relative w-full max-w-xl group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-2xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
            <div className="relative flex items-center">
              <Search size={20} className="absolute left-4 text-[#8892AA]" />
              <input 
                type="text" 
                placeholder="Search documentation, guides, and FAQs..."
                className="w-full bg-[#05070B] border border-white/[0.08] rounded-2xl pl-12 pr-4 py-4 text-base text-[#F1F3F9] placeholder:text-[#4A5168] focus:outline-none focus:border-purple-500/50 transition-colors shadow-inner"
              />
              <div className="absolute right-3 flex items-center gap-1">
                <kbd className="px-2 py-1 rounded-md bg-white/[0.04] border border-white/[0.08] text-[10px] font-semibold text-[#8892AA]">⌘</kbd>
                <kbd className="px-2 py-1 rounded-md bg-white/[0.04] border border-white/[0.08] text-[10px] font-semibold text-[#8892AA]">K</kbd>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {[
          { id: 'documentation', title: 'Browse Documentation', desc: 'Read guides and API references', icon: BookOpen, color: 'text-blue-400', bg: 'bg-blue-400/10' },
          { id: 'support', title: 'Contact Support', desc: 'Get help from our engineering team', icon: MessageSquare, color: 'text-purple-400', bg: 'bg-purple-400/10' },
          { id: 'changelog', title: 'View Changelog', desc: 'See what we recently shipped', icon: ListOrdered, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
          { id: 'support', title: 'Report an Issue', desc: 'Found a bug? Let us know', icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-400/10' },
        ].map((action, i) => (
          <motion.button
            key={i}
            onClick={() => onNavigate(action.id)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 * i }}
            whileHover={{ y: -2, scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="flex items-start gap-4 p-5 rounded-[24px] bg-[#0F1117] border border-white/[0.04] hover:border-white/[0.1] hover:bg-white/[0.02] transition-all group text-left"
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${action.bg}`}>
              <action.icon size={20} className={action.color} />
            </div>
            <div className="flex-1 mt-0.5">
              <h3 className="text-[#F1F3F9] font-semibold mb-1 group-hover:text-purple-400 transition-colors">{action.title}</h3>
              <p className="text-[#8892AA] text-sm">{action.desc}</p>
            </div>
            <ArrowRight size={16} className="text-[#4A5168] mt-1 group-hover:text-[#F1F3F9] group-hover:translate-x-1 transition-all" />
          </motion.button>
        ))}
      </div>

    </div>
  );
}
