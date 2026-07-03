'use client';

import { motion } from 'framer-motion';
import { Keyboard, Command, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, CornerDownLeft } from 'lucide-react';

const SHORTCUT_GROUPS = [
  {
    category: 'Global & Navigation',
    shortcuts: [
      { label: 'Command Center', keys: ['⌘', 'K'] },
      { label: 'Global Search', keys: ['⌘', 'F'] },
      { label: 'Go to Dashboard', keys: ['G', 'D'] },
      { label: 'Go to Settings', keys: ['G', 'S'] },
      { label: 'Open Notifications', keys: ['⇧', '⌘', 'N'] },
      { label: 'Toggle Theme', keys: ['⇧', 'D'] },
    ]
  },
  {
    category: 'AI Chat',
    shortcuts: [
      { label: 'New Chat', keys: ['⌘', 'N'] },
      { label: 'Focus Message Input', keys: ['/'] },
      { label: 'Submit Message', keys: [<CornerDownLeft key="enter" size={12} />] },
      { label: 'Stop Generation', keys: ['Esc'] },
      { label: 'Previous Chat', keys: ['⌘', '↑'] },
      { label: 'Next Chat', keys: ['⌘', '↓'] },
    ]
  },
  {
    category: 'Documents',
    shortcuts: [
      { label: 'Upload Document', keys: ['⌘', 'U'] },
      { label: 'New Collection', keys: ['⌘', '⇧', 'C'] },
      { label: 'Select All', keys: ['⌘', 'A'] },
      { label: 'Delete Selected', keys: ['⌘', '⌫'] },
      { label: 'Preview Document', keys: ['Space'] },
    ]
  }
];

export function ShortcutsTab() {
  return (
    <div className="flex flex-col animate-in fade-in duration-500 max-w-4xl">
      
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#F1F3F9] tracking-tight flex items-center gap-3">
            <Keyboard className="text-purple-400" size={28} />
            Keyboard Shortcuts
          </h1>
          <p className="text-[#8892AA] mt-2 text-lg">Work faster with these keyboard combinations.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {SHORTCUT_GROUPS.map((group, groupIdx) => (
          <div key={group.category} className="flex flex-col gap-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#4A5168] pl-2">
              {group.category}
            </h2>
            
            <div className="bg-[#0F1117] border border-white/[0.06] rounded-[24px] overflow-hidden">
              {group.shortcuts.map((shortcut, idx) => (
                <div 
                  key={shortcut.label}
                  className={`flex items-center justify-between p-4 ${
                    idx !== group.shortcuts.length - 1 ? 'border-b border-white/[0.04]' : ''
                  } hover:bg-white/[0.02] transition-colors`}
                >
                  <span className="text-sm font-medium text-[#F1F3F9]">{shortcut.label}</span>
                  <div className="flex items-center gap-1.5">
                    {shortcut.keys.map((k, i) => (
                      <motion.kbd
                        key={i}
                        whileHover={{ y: -2, scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="min-w-[28px] h-7 flex items-center justify-center px-2 bg-[#05070B] border border-white/[0.1] rounded-md text-xs font-semibold text-[#8892AA] shadow-[0_2px_0_rgba(255,255,255,0.05)]"
                      >
                        {k}
                      </motion.kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
