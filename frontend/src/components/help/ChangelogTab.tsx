'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ListOrdered, ChevronDown, ChevronUp, Plus, RefreshCw, XCircle, Wrench, Shield } from 'lucide-react';

const CHANGELOG = [
  {
    version: '2.4.0',
    date: 'Oct 15, 2026',
    changes: [
      { type: 'added', desc: 'Support for Claude 3.5 Sonnet.' },
      { type: 'added', desc: 'Support for GPT-4o.' },
      { type: 'changed', desc: 'Vector search now uses HNSW index by default.' },
      { type: 'deprecated', desc: 'Legacy /v1/documents/sync endpoint (use /v2 instead).' },
      { type: 'fixed', desc: 'Race condition in concurrent API key generation.' },
    ]
  },
  {
    version: '2.3.5',
    date: 'Sep 28, 2026',
    changes: [
      { type: 'changed', desc: 'Migrated real-time syncing to new websocket infrastructure.' },
      { type: 'added', desc: 'Pagination to all list endpoints in the API.' },
      { type: 'fixed', desc: 'Memory leak in the desktop client.' },
      { type: 'security', desc: 'Updated underlying OS packages to patch CVE-2026-1234.' },
    ]
  },
  {
    version: '2.3.0',
    date: 'Sep 10, 2026',
    changes: [
      { type: 'added', desc: 'Role-based access control (Admin, Member, Viewer).' },
      { type: 'added', desc: 'Audit logs for tracking workspace activity.' },
      { type: 'changed', desc: 'Settings UI redesigned for easier navigation.' },
    ]
  }
];

const TYPE_CONFIG = {
  added: { icon: Plus, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  changed: { icon: RefreshCw, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  deprecated: { icon: XCircle, color: 'text-amber-400', bg: 'bg-amber-400/10' },
  fixed: { icon: Wrench, color: 'text-purple-400', bg: 'bg-purple-400/10' },
  security: { icon: Shield, color: 'text-rose-400', bg: 'bg-rose-400/10' },
};

function ChangelogEntry({ entry }: { entry: any }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="bg-[#0F1117] border border-white/[0.06] rounded-[24px] overflow-hidden mb-6 shadow-sm">
      <button 
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-6 bg-white/[0.01] hover:bg-white/[0.03] transition-colors text-left"
      >
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-[#F1F3F9] font-mono">v{entry.version}</h2>
          <span className="text-sm text-[#4A5168]">{entry.date}</span>
        </div>
        {expanded ? <ChevronUp size={18} className="text-[#4A5168]" /> : <ChevronDown size={18} className="text-[#4A5168]" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-6 pt-0 border-t border-white/[0.04]">
              <div className="space-y-3 mt-4">
                {entry.changes.map((change: any, i: number) => {
                  const config = TYPE_CONFIG[change.type as keyof typeof TYPE_CONFIG];
                  const Icon = config.icon;
                  return (
                    <div key={i} className="flex items-start gap-4 text-sm">
                      <div className={`mt-0.5 px-2 py-1 flex items-center gap-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider w-28 shrink-0 ${config.bg} ${config.color}`}>
                        <Icon size={12} />
                        {change.type}
                      </div>
                      <span className="text-[#F1F3F9] leading-relaxed pt-0.5">{change.desc}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ChangelogTab() {
  return (
    <div className="flex flex-col animate-in fade-in duration-500 max-w-4xl">
      <div className="flex items-center justify-between mb-12">
        <div>
          <h1 className="text-3xl font-bold text-[#F1F3F9] tracking-tight flex items-center gap-3">
            <ListOrdered className="text-purple-400" size={28} />
            Changelog
          </h1>
          <p className="text-[#8892AA] mt-2 text-lg">A detailed technical log of all updates to the platform.</p>
        </div>
      </div>

      <div className="space-y-2">
        {CHANGELOG.map((entry) => (
          <ChangelogEntry key={entry.version} entry={entry} />
        ))}
      </div>
    </div>
  );
}
