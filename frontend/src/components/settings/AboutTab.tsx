'use client';

import { Info, ExternalLink, CheckCircle2, AlertCircle, Loader2, Copy, CheckCheck } from 'lucide-react';
import { useSystemHealth } from '@/hooks/useSystemHealth';
import { useState } from 'react';

const APP_VERSION = '0.10.0';
const BUILD_DATE = '2026-07-04';
const ENVIRONMENT = process.env.NODE_ENV === 'production' ? 'production' : 'development';

const DOCS_LINKS = [
  { label: 'Getting Started', href: '#', description: 'Set up your first workspace and upload documents' },
  { label: 'API Reference', href: '#', description: 'Integrate Clarity via REST API' },
  { label: 'Architecture Overview', href: '#', description: 'Two-signal verification and RAG pipeline' },
  { label: 'Release Notes', href: '/developer/release-notes', description: 'Changelog and version history' },
];

export function AboutTab() {
  const { data: health, isLoading, isError } = useSystemHealth();
  const [copied, setCopied] = useState(false);

  const handleCopyVersion = () => {
    void navigator.clipboard.writeText(`Clarity ${APP_VERSION} (${BUILD_DATE})`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const overallStatus = isLoading ? 'checking' : isError ? 'unavailable' : health?.status ?? 'unavailable';

  const statusConfig = {
    ready: { color: 'bg-emerald-500', text: 'All Systems Operational', textColor: 'text-emerald-400' },
    degraded: { color: 'bg-amber-500', text: 'Degraded Performance', textColor: 'text-amber-400' },
    unavailable: { color: 'bg-red-500', text: 'Service Unavailable', textColor: 'text-red-400' },
    checking: { color: 'bg-blue-500', text: 'Checking Status...', textColor: 'text-blue-400' },
  };

  const { color: statusColor, text: statusText, textColor } = statusConfig[overallStatus] ?? statusConfig.unavailable;

  return (
    <div className="flex flex-col animate-in fade-in duration-500 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#F1F3F9] tracking-tight flex items-center gap-2">
          <Info size={22} className="text-purple-400" />
          About Clarity
        </h1>
        <p className="text-sm text-[#8892AA] mt-1">System information, version details, and documentation.</p>
      </div>

      <div className="space-y-6">
        {/* Version Info */}
        <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5B6EF0] to-[#8B5CF6] flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="white">
                    <path d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#F1F3F9]">Clarity AI Docs</h2>
                  <p className="text-xs text-[#8892AA]">Enterprise AI Document Intelligence</p>
                </div>
              </div>
            </div>
            <button
              onClick={handleCopyVersion}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-[#8892AA] hover:text-[#F1F3F9] hover:bg-white/[0.08] transition-colors"
            >
              {copied ? <CheckCheck size={13} className="text-emerald-400" /> : <Copy size={13} />}
              Copy
            </button>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-4">
            {[
              { label: 'Version', value: `v${APP_VERSION}` },
              { label: 'Build Date', value: BUILD_DATE },
              { label: 'Environment', value: ENVIRONMENT },
            ].map(({ label, value }) => (
              <div key={label} className="bg-[#05070B] rounded-xl p-3 border border-white/[0.04]">
                <p className="text-[10px] font-semibold text-[#4A5168] uppercase tracking-wider mb-1">{label}</p>
                <p className="text-sm font-mono text-[#F1F3F9]">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* System Status */}
        <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-bold text-[#F1F3F9]">System Status</h2>
            <div className={`flex items-center gap-2 text-xs font-medium ${textColor}`}>
              {isLoading ? <Loader2 size={14} className="animate-spin" /> : <div className={`w-2 h-2 rounded-full ${statusColor} ${overallStatus === 'ready' ? 'animate-pulse' : ''}`} />}
              {statusText}
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-white/[0.02] rounded-lg animate-pulse" />
              ))}
            </div>
          ) : health?.checks ? (
            <div className="space-y-3">
              {Object.entries(health.checks).map(([checkName, result]) => (
                <div key={checkName} className="flex items-center justify-between p-3 bg-[#05070B] rounded-xl border border-white/[0.04]">
                  <div className="flex items-center gap-3">
                    {result.ok
                      ? <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                      : <AlertCircle size={16} className="text-red-400 shrink-0" />}
                    <div>
                      <p className="text-sm font-medium text-[#F1F3F9] capitalize">{checkName.replace(/_/g, ' ')}</p>
                      {result.detail && <p className="text-xs text-[#8892AA]">{result.detail}</p>}
                    </div>
                  </div>
                  {result.latency_ms != null && (
                    <span className="text-xs font-mono text-[#4A5168]">{result.latency_ms.toFixed(1)}ms</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-sm text-[#8892AA]">
              Unable to reach health endpoint.
            </div>
          )}

          {health && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="p-3 bg-[#05070B] rounded-xl border border-white/[0.04]">
                <p className="text-[10px] font-semibold text-[#4A5168] uppercase tracking-wider mb-1">Backend Version</p>
                <p className="text-sm font-mono text-[#F1F3F9]">{health.version}</p>
              </div>
              <div className="p-3 bg-[#05070B] rounded-xl border border-white/[0.04]">
                <p className="text-[10px] font-semibold text-[#4A5168] uppercase tracking-wider mb-1">Environment</p>
                <p className="text-sm font-mono text-[#F1F3F9] capitalize">{health.environment}</p>
              </div>
            </div>
          )}
        </div>

        {/* Documentation */}
        <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-6">
          <h2 className="text-sm font-bold text-[#F1F3F9] mb-4">Documentation & Resources</h2>
          <div className="space-y-2">
            {DOCS_LINKS.map(({ label, href, description }) => (
              <a
                key={label}
                href={href}
                className="flex items-center justify-between p-3 bg-[#05070B] rounded-xl border border-white/[0.04] hover:border-purple-500/30 hover:bg-purple-500/5 transition-all group"
              >
                <div>
                  <p className="text-sm font-medium text-[#F1F3F9] group-hover:text-purple-400 transition-colors">{label}</p>
                  <p className="text-xs text-[#4A5168] mt-0.5">{description}</p>
                </div>
                <ExternalLink size={14} className="text-[#4A5168] group-hover:text-purple-400 transition-colors shrink-0" />
              </a>
            ))}
          </div>
        </div>

        {/* Legal */}
        <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-6">
          <h2 className="text-sm font-bold text-[#F1F3F9] mb-4">Legal</h2>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {['Privacy Policy', 'Terms of Service', 'Cookie Policy'].map((item) => (
              <a key={item} href="#" className="text-[#8892AA] hover:text-purple-400 transition-colors underline-offset-2 hover:underline">
                {item}
              </a>
            ))}
          </div>
          <p className="text-xs text-[#4A5168] mt-4">
            © 2026 Clarity AI. All rights reserved. Built with Next.js, FastAPI, Supabase, Pinecone, and OpenAI.
          </p>
        </div>
      </div>
    </div>
  );
}
