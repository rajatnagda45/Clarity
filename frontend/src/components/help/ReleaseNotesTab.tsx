'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, Sparkles, Wrench, Zap, CheckCircle2, Bug } from 'lucide-react';

const RELEASES = [
  {
    version: 'v2.4.0',
    date: 'October 15, 2026',
    title: 'Advanced Analytics & AI Models',
    description: 'We are thrilled to introduce major improvements to our analytics engine and support for the latest foundational models.',
    features: [
      'Added support for Claude 3.5 Sonnet and GPT-4o models.',
      'New Analytics Dashboard with token consumption tracking.',
      'Introduced Collections API for programmatic organization.'
    ],
    improvements: [
      'Vector search latency reduced by 40%.',
      'Improved PDF parsing accuracy for complex tables.',
      'Dark mode contrasts optimized for accessibility.'
    ],
    fixes: [
      'Fixed an issue where large files failed to chunk correctly.',
      'Resolved a race condition during concurrent API key generation.'
    ]
  },
  {
    version: 'v2.3.5',
    date: 'September 28, 2026',
    title: 'Performance & Stability Update',
    description: 'A minor release focused on infrastructure scaling and bug fixes to support our growing enterprise customer base.',
    features: [],
    improvements: [
      'Migrated real-time syncing to a new websocket infrastructure.',
      'Added pagination to all list endpoints in the API.'
    ],
    fixes: [
      'Fixed a memory leak in the desktop client.',
      'Resolved SSO login failures for specific identity providers.'
    ]
  },
  {
    version: 'v2.3.0',
    date: 'September 10, 2026',
    title: 'Enterprise Workspaces',
    description: 'Introducing role-based access control and advanced workspace management for enterprise teams.',
    features: [
      'Role-based access control (Admin, Member, Viewer).',
      'Audit logs for tracking workspace activity.',
      'Custom SSO configurations via SAML/OIDC.'
    ],
    improvements: [
      'Settings UI redesigned for easier navigation.',
      'Improved invitation flow with email verification.'
    ],
    fixes: []
  }
];

export function ReleaseNotesTab() {
  return (
    <div className="flex flex-col animate-in fade-in duration-500 max-w-4xl">
      
      <div className="flex items-center justify-between mb-12">
        <div>
          <h1 className="text-3xl font-bold text-[#F1F3F9] tracking-tight flex items-center gap-3">
            <Zap className="text-purple-400" size={28} />
            Release Notes
          </h1>
          <p className="text-[#8892AA] mt-2 text-lg">Discover the latest features, improvements, and bug fixes.</p>
        </div>
      </div>

      <div className="relative border-l border-white/[0.08] ml-4 md:ml-6 space-y-16 pb-12">
        {RELEASES.map((release, i) => (
          <motion.div 
            key={release.version}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            className="relative pl-8 md:pl-12"
          >
            {/* Timeline dot */}
            <div className="absolute left-[-9px] top-1.5 w-4 h-4 rounded-full bg-[#05070B] border-2 border-purple-500 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            </div>

            {/* Version and Date Header */}
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 mb-4">
              <h2 className="text-2xl font-bold text-[#F1F3F9]">{release.version}</h2>
              <span className="text-sm font-medium text-[#4A5168] bg-white/[0.04] px-3 py-1 rounded-full border border-white/[0.04] w-fit">
                {release.date}
              </span>
            </div>

            <div className="bg-[#0F1117] border border-white/[0.06] rounded-[24px] p-6 md:p-8 shadow-lg">
              <h3 className="text-xl font-semibold text-[#F1F3F9] mb-3">{release.title}</h3>
              <p className="text-[#8892AA] mb-8 leading-relaxed text-base">{release.description}</p>
              
              <div className="space-y-6">
                {release.features.length > 0 && (
                  <div>
                    <h4 className="flex items-center gap-2 text-sm font-bold text-emerald-400 uppercase tracking-wider mb-3">
                      <Sparkles size={16} /> New Features
                    </h4>
                    <ul className="space-y-2">
                      {release.features.map((item, j) => (
                        <li key={j} className="flex items-start gap-3 text-[#F1F3F9]">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/50 mt-2 shrink-0" />
                          <span className="leading-relaxed">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {release.improvements.length > 0 && (
                  <div>
                    <h4 className="flex items-center gap-2 text-sm font-bold text-blue-400 uppercase tracking-wider mb-3 mt-6">
                      <Wrench size={16} /> Improvements
                    </h4>
                    <ul className="space-y-2">
                      {release.improvements.map((item, j) => (
                        <li key={j} className="flex items-start gap-3 text-[#F1F3F9]">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-400/50 mt-2 shrink-0" />
                          <span className="leading-relaxed">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {release.fixes.length > 0 && (
                  <div>
                    <h4 className="flex items-center gap-2 text-sm font-bold text-amber-400 uppercase tracking-wider mb-3 mt-6">
                      <Bug size={16} /> Bug Fixes
                    </h4>
                    <ul className="space-y-2">
                      {release.fixes.map((item, j) => (
                        <li key={j} className="flex items-start gap-3 text-[#F1F3F9]">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-400/50 mt-2 shrink-0" />
                          <span className="leading-relaxed">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
