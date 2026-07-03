'use client';

import { motion } from 'framer-motion';
import { Lightbulb, ChevronUp, MessageCircle, Clock, CheckCircle2, PlayCircle } from 'lucide-react';

const REQUESTS = [
  {
    id: 1,
    title: 'Notion Integration for Workspace',
    desc: 'Would love to be able to sync our Notion databases directly into the vector store so AI can read our internal wikis.',
    votes: 432,
    comments: 24,
    status: 'in-progress',
    author: 'Sarah J.'
  },
  {
    id: 2,
    title: 'Custom System Prompts per Collection',
    desc: 'We need the ability to define a specific persona for different collections rather than relying on the global workspace prompt.',
    votes: 385,
    comments: 12,
    status: 'planned',
    author: 'Mike T.'
  },
  {
    id: 3,
    title: 'Export Chat History to PDF',
    desc: 'Our compliance team requires us to archive certain conversations. A native PDF export would be amazing.',
    votes: 156,
    comments: 3,
    status: 'planned',
    author: 'Elena R.'
  },
  {
    id: 4,
    title: 'Dark Mode Support',
    desc: 'A dark theme for the entire dashboard.',
    votes: 892,
    comments: 45,
    status: 'released',
    author: 'David L.'
  }
];

const STATUS_CONFIG = {
  'planned': { label: 'Planned', icon: Clock, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  'in-progress': { label: 'In Progress', icon: PlayCircle, color: 'text-amber-400', bg: 'bg-amber-400/10' },
  'released': { label: 'Released', icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
};

export function FeatureRequestsTab() {
  return (
    <div className="flex flex-col animate-in fade-in duration-500 max-w-4xl">
      
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#F1F3F9] tracking-tight flex items-center gap-3">
            <Lightbulb className="text-purple-400" size={28} />
            Feature Requests
          </h1>
          <p className="text-[#8892AA] mt-2 text-lg">Help us shape the future of Clarity by sharing your ideas.</p>
        </div>
        <button className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-purple-500 hover:bg-purple-600 text-white transition-colors shadow-[0_0_15px_rgba(168,85,247,0.4)]">
          Submit Request
        </button>
      </div>

      <div className="space-y-4">
        {REQUESTS.map((req, i) => {
          const status = STATUS_CONFIG[req.status as keyof typeof STATUS_CONFIG];
          const StatusIcon = status.icon;
          
          return (
            <motion.div 
              key={req.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="flex items-start gap-4 p-5 rounded-[20px] bg-[#0F1117] border border-white/[0.04] hover:border-white/[0.08] transition-all"
            >
              <div className="flex flex-col items-center gap-1 shrink-0 bg-white/[0.02] border border-white/[0.04] rounded-xl p-2 min-w-[60px]">
                <button className="p-1 hover:text-purple-400 text-[#8892AA] transition-colors">
                  <ChevronUp size={20} />
                </button>
                <span className="font-bold text-[#F1F3F9]">{req.votes}</span>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-lg font-semibold text-[#F1F3F9] truncate">{req.title}</h3>
                  <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${status.bg} ${status.color}`}>
                    <StatusIcon size={12} />
                    {status.label}
                  </div>
                </div>
                <p className="text-[#8892AA] text-sm mb-4 leading-relaxed line-clamp-2">{req.desc}</p>
                
                <div className="flex items-center gap-4 text-xs font-medium text-[#4A5168]">
                  <span>By {req.author}</span>
                  <div className="flex items-center gap-1.5 hover:text-[#8892AA] transition-colors cursor-pointer">
                    <MessageCircle size={14} />
                    {req.comments} Comments
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

    </div>
  );
}
