'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plug, CheckCircle2, AlertCircle, Clock, RefreshCw, Unplug, ExternalLink } from 'lucide-react';
import { useIntegrations, useDisconnectIntegration } from '@/hooks/useEnterprise';
import { useToast } from '@/contexts/ToastContext';
import type { Integration } from '@/types/clarity';

const PROVIDER_ICONS: Record<string, string> = {
  google_drive: '🗂️',
  onedrive: '☁️',
  dropbox: '📦',
  box: '🗃️',
  sharepoint: '🏢',
  slack: '💬',
  teams: '🔵',
  notion: '📝',
  github: '🐙',
  jira: '🎯',
  confluence: '📚',
  gmail: '📧',
  outlook: '📮',
};

const PROVIDER_COLORS: Record<string, string> = {
  google_drive: 'from-blue-500/20 to-green-500/20',
  onedrive: 'from-blue-600/20 to-blue-400/20',
  dropbox: 'from-blue-500/20 to-cyan-400/20',
  box: 'from-blue-600/20 to-blue-500/20',
  sharepoint: 'from-indigo-500/20 to-blue-500/20',
  slack: 'from-purple-500/20 to-pink-500/20',
  teams: 'from-indigo-500/20 to-violet-500/20',
  notion: 'from-gray-500/20 to-gray-400/20',
  github: 'from-gray-600/20 to-gray-500/20',
  jira: 'from-blue-500/20 to-indigo-500/20',
  confluence: 'from-blue-400/20 to-teal-400/20',
  gmail: 'from-red-500/20 to-orange-400/20',
  outlook: 'from-blue-600/20 to-cyan-500/20',
};

function StatusBadge({ status }: { status: Integration['status'] }) {
  const cfg = {
    active: { label: 'Connected', color: 'bg-emerald-500/15 text-emerald-400', icon: <CheckCircle2 size={11} /> },
    disconnected: { label: 'Disconnected', color: 'bg-[#4A5168]/20 text-[#4A5168]', icon: <Unplug size={11} /> },
    error: { label: 'Error', color: 'bg-red-500/15 text-red-400', icon: <AlertCircle size={11} /> },
    not_connected: { label: 'Not connected', color: 'bg-white/[0.04] text-[#4A5168]', icon: <Clock size={11} /> },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.color}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function IntegrationCard({ integration }: { integration: Integration }) {
  const { toast } = useToast();
  const disconnect = useDisconnectIntegration();
  const icon = PROVIDER_ICONS[integration.provider] ?? '🔌';
  const gradient = PROVIDER_COLORS[integration.provider] ?? 'from-purple-500/20 to-blue-500/20';
  const isConnected = integration.status === 'active';
  const isComingSoon = !integration.featureFlag;

  const handleAction = () => {
    if (isComingSoon) {
      toast.info(`${integration.displayName} integration is coming soon. Enterprise beta access available — contact support.`);
      return;
    }
    if (isConnected) {
      disconnect.mutate(integration.provider, {
        onSuccess: () => toast.success(`${integration.displayName} disconnected.`),
        onError: () => toast.error('Failed to disconnect.'),
      });
      return;
    }
    toast.info(`OAuth flow for ${integration.displayName} requires backend configuration. Contact your administrator.`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative bg-[#0F1117] border border-white/[0.06] rounded-2xl p-5 hover:border-white/[0.1] transition-all duration-200"
    >
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-2xl shrink-0 border border-white/[0.06]`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-semibold text-[#F1F3F9]">{integration.displayName}</p>
            {isComingSoon && (
              <span className="text-[9px] font-bold uppercase tracking-wider text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded-full">
                Soon
              </span>
            )}
          </div>
          <p className="text-xs text-[#4A5168] leading-relaxed mb-3">{integration.description}</p>

          <div className="flex items-center justify-between">
            <StatusBadge status={integration.status} />
            {isConnected && integration.lastSyncAt && (
              <span className="text-[10px] text-[#4A5168]">
                Synced {new Date(integration.lastSyncAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-white/[0.04] flex items-center gap-2">
        <button
          onClick={handleAction}
          disabled={disconnect.isPending}
          className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${
            isConnected
              ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20'
              : isComingSoon
              ? 'bg-white/[0.03] text-[#4A5168] border border-white/[0.04] cursor-default'
              : 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/20'
          }`}
        >
          {disconnect.isPending ? (
            <RefreshCw size={12} className="animate-spin mx-auto" />
          ) : isConnected ? (
            'Disconnect'
          ) : isComingSoon ? (
            'Coming Soon'
          ) : (
            'Connect'
          )}
        </button>
        {isConnected && (
          <button
            onClick={() => toast.info('Manual sync triggered.')}
            className="px-3 py-2 rounded-xl text-xs font-medium text-[#8892AA] hover:text-[#F1F3F9] bg-white/[0.03] border border-white/[0.04] hover:border-white/[0.08] transition-colors"
          >
            <RefreshCw size={12} />
          </button>
        )}
      </div>
    </motion.div>
  );
}

const CATEGORIES = [
  { label: 'All', value: 'all' },
  { label: 'Storage', value: 'storage', providers: ['google_drive', 'onedrive', 'dropbox', 'box', 'sharepoint'] },
  { label: 'Communication', value: 'communication', providers: ['slack', 'teams', 'gmail', 'outlook'] },
  { label: 'Productivity', value: 'productivity', providers: ['notion', 'github', 'jira', 'confluence'] },
];

export function IntegrationsTab() {
  const { data, isLoading, isError } = useIntegrations();
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const integrations = data?.integrations ?? [];
  const filtered = activeCategory === 'all'
    ? integrations
    : (CATEGORIES.find(c => c.value === activeCategory)?.providers ?? [])
        .map(p => integrations.find(i => i.provider === p))
        .filter(Boolean) as typeof integrations;

  const connected = integrations.filter(i => i.status === 'active').length;

  return (
    <div className="flex flex-col animate-in fade-in duration-500 max-w-5xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Plug size={22} className="text-purple-400" />
            Integrations
          </h1>
          <p className="text-sm text-[#8892AA] mt-1">
            Connect external services to sync documents, send alerts, and automate workflows.
          </p>
        </div>
        {connected > 0 && (
          <div className="text-right shrink-0">
            <p className="text-sm font-bold text-emerald-400">{connected} active</p>
            <p className="text-xs text-[#4A5168]">of {integrations.length} available</p>
          </div>
        )}
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {CATEGORIES.map(cat => (
          <button
            key={cat.value}
            onClick={() => setActiveCategory(cat.value)}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              activeCategory === cat.value
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                : 'bg-white/[0.03] text-[#4A5168] border border-white/[0.06] hover:text-[#F1F3F9]'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 bg-white/[0.03] border border-white/[0.04] rounded-2xl animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-[#0F1117] border border-white/[0.06] rounded-2xl">
          <AlertCircle size={32} className="text-red-400 mb-3" />
          <p className="text-sm text-[#F1F3F9] font-semibold">Failed to load integrations</p>
        </div>
      )}

      {!isLoading && !isError && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(integration => (
            <IntegrationCard key={integration.provider} integration={integration} />
          ))}
        </div>
      )}

      <div className="mt-8 p-5 rounded-2xl bg-blue-500/[0.07] border border-blue-500/20 flex gap-4">
        <ExternalLink size={18} className="text-blue-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue-400 mb-1">Enterprise OAuth Setup</p>
          <p className="text-xs text-[#8892AA] leading-relaxed">
            Production OAuth credentials and webhook signing keys must be configured by your workspace administrator.
            Contact support to enable specific integrations for your organization.
          </p>
        </div>
      </div>
    </div>
  );
}
