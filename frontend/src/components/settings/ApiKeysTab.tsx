'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Key, Plus, Trash2, Copy, CheckCircle2, AlertCircle, Shield, Eye, EyeOff } from 'lucide-react';
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from '@/hooks/useEnterprise';
import { useToast } from '@/contexts/ToastContext';
import { formatRelativeTime } from '@/lib/time';
import type { ApiKey } from '@/types/clarity';

const AVAILABLE_SCOPES = [
  { value: 'documents:read', label: 'Documents Read', description: 'Read document content and metadata' },
  { value: 'documents:write', label: 'Documents Write', description: 'Upload and modify documents' },
  { value: 'collections:read', label: 'Collections Read', description: 'Browse and query collections' },
  { value: 'collections:write', label: 'Collections Write', description: 'Create and manage collections' },
  { value: 'evals:read', label: 'Evals Read', description: 'Read evaluation results' },
  { value: 'evals:write', label: 'Evals Write', description: 'Run evaluations' },
  { value: 'benchmarks:read', label: 'Benchmarks Read', description: 'Read benchmark results' },
  { value: 'workspace:admin', label: 'Workspace Admin', description: 'Full workspace management access' },
];

const EXPIRE_OPTIONS = [
  { label: 'No expiration', value: null },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
  { label: '180 days', value: 180 },
  { label: '365 days', value: 365 },
];

function CreateKeyModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const create = useCreateApiKey();
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>(['documents:read']);
  const [expiresInDays, setExpiresInDays] = useState<number | null>(null);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const toggleScope = (s: string) =>
    setScopes(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const handleCopy = async () => {
    if (!createdKey) return;
    await navigator.clipboard.writeText(createdKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreate = () => {
    if (!name.trim()) { toast.error('Key name is required.'); return; }
    if (scopes.length === 0) { toast.error('Select at least one scope.'); return; }
    create.mutate(
      { name: name.trim(), scopes, expiresInDays: expiresInDays ?? undefined },
      {
        onSuccess: (key) => {
          toast.success('API key created.');
          setCreatedKey(key.plaintextKey);
        },
        onError: () => toast.error('Failed to create API key.'),
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        className="bg-[#0F1117] border border-white/[0.1] rounded-2xl p-6 w-full max-w-lg shadow-2xl"
      >
        {createdKey ? (
          <>
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 size={20} className="text-emerald-400" />
              <h2 className="text-base font-bold text-[#F1F3F9]">API Key Created</h2>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-4">
              <p className="text-xs font-semibold text-amber-400 mb-3">⚠ Copy your key now — it will never be shown again</p>
              <div className="flex items-center gap-2 bg-black/30 rounded-lg p-3">
                <code className="flex-1 text-xs font-mono text-[#F1F3F9] break-all select-all">{createdKey}</code>
                <button
                  onClick={handleCopy}
                  className={`shrink-0 p-1.5 rounded-lg transition-colors ${copied ? 'text-emerald-400' : 'text-[#4A5168] hover:text-[#F1F3F9]'}`}
                >
                  {copied ? <CheckCircle2 size={15} /> : <Copy size={15} />}
                </button>
              </div>
            </div>
            <p className="text-xs text-[#4A5168] mb-5 leading-relaxed">
              This key has been created with the scopes you selected. Store it securely — treat it like a password.
            </p>
            <button onClick={onClose} className="w-full py-2.5 bg-white text-black rounded-xl text-sm font-semibold hover:bg-slate-100 transition-colors">
              Done
            </button>
          </>
        ) : (
          <>
            <h2 className="text-base font-bold text-[#F1F3F9] mb-5">Create API Key</h2>
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-[#8892AA] mb-1.5">Key Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Production Integration, CI Pipeline"
                  className="w-full bg-[#151923] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-[#F1F3F9] placeholder:text-[#4A5168] focus:outline-none focus:border-purple-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#8892AA] mb-2">Permissions *</label>
                <div className="grid grid-cols-2 gap-1.5 max-h-52 overflow-y-auto pr-1">
                  {AVAILABLE_SCOPES.map(s => (
                    <button
                      key={s.value}
                      onClick={() => toggleScope(s.value)}
                      className={`text-left px-3 py-2 rounded-lg transition-colors border ${
                        scopes.includes(s.value)
                          ? 'bg-purple-500/15 border-purple-500/30 text-purple-300'
                          : 'bg-white/[0.02] border-white/[0.06] text-[#4A5168] hover:text-[#8892AA]'
                      }`}
                    >
                      <p className="text-[11px] font-semibold">{s.label}</p>
                      <p className="text-[9px] mt-0.5 opacity-70">{s.description}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#8892AA] mb-1.5">Expiration</label>
                <div className="flex gap-2 flex-wrap">
                  {EXPIRE_OPTIONS.map(opt => (
                    <button
                      key={String(opt.value)}
                      onClick={() => setExpiresInDays(opt.value)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                        expiresInDays === opt.value
                          ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                          : 'bg-white/[0.03] text-[#4A5168] border border-white/[0.06] hover:text-[#F1F3F9]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#8892AA] bg-white/[0.04] hover:bg-white/[0.08] transition-colors">
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={create.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50 transition-colors"
              >
                {create.isPending ? 'Creating…' : 'Create Key'}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}

function ApiKeyRow({ apiKey }: { apiKey: ApiKey }) {
  const { toast } = useToast();
  const revoke = useRevokeApiKey();
  const [showPrefix, setShowPrefix] = useState(false);
  const isExpired = apiKey.expiresAt ? new Date(apiKey.expiresAt) < new Date() : false;

  return (
    <tr className="border-b border-white/[0.03] hover:bg-white/[0.01] transition-colors">
      <td className="px-5 py-4">
        <p className="text-sm font-semibold text-[#F1F3F9]">{apiKey.name}</p>
        <p className="text-[10px] text-[#4A5168] mt-0.5">Created {formatRelativeTime(apiKey.createdAt)}</p>
      </td>
      <td className="px-5 py-4">
        <div className="flex items-center gap-2">
          <code className="text-xs font-mono text-[#4A5168] bg-white/[0.04] px-2 py-1 rounded-lg">
            {showPrefix ? apiKey.keyPrefix + '…' : '••••••••••••••••'}
          </code>
          <button
            onClick={() => setShowPrefix(v => !v)}
            className="text-[#4A5168] hover:text-[#8892AA] transition-colors"
          >
            {showPrefix ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        </div>
      </td>
      <td className="px-5 py-4">
        <div className="flex flex-wrap gap-1">
          {apiKey.scopes.slice(0, 3).map(s => (
            <span key={s} className="text-[9px] font-mono font-bold bg-white/[0.04] text-[#4A5168] px-1.5 py-0.5 rounded-md">{s}</span>
          ))}
          {apiKey.scopes.length > 3 && (
            <span className="text-[9px] text-[#4A5168]">+{apiKey.scopes.length - 3}</span>
          )}
        </div>
      </td>
      <td className="px-5 py-4 text-xs text-[#4A5168]">
        {apiKey.lastUsedAt ? formatRelativeTime(apiKey.lastUsedAt) : 'Never'}
      </td>
      <td className="px-5 py-4 text-xs">
        {isExpired ? (
          <span className="text-red-400 font-semibold">Expired</span>
        ) : apiKey.expiresAt ? (
          <span className="text-[#4A5168]">{new Date(apiKey.expiresAt).toLocaleDateString()}</span>
        ) : (
          <span className="text-[#4A5168]">Never</span>
        )}
      </td>
      <td className="px-5 py-4 text-right">
        <button
          onClick={() => revoke.mutate(apiKey.id, {
            onSuccess: () => toast.success('Key revoked.'),
            onError: () => toast.error('Failed to revoke key.'),
          })}
          disabled={revoke.isPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-colors disabled:opacity-50"
        >
          <Trash2 size={12} />
          Revoke
        </button>
      </td>
    </tr>
  );
}

export function ApiKeysTab() {
  const { data, isLoading, isError } = useApiKeys();
  const [showCreate, setShowCreate] = useState(false);
  const keys = data?.keys ?? [];

  return (
    <div className="flex flex-col animate-in fade-in duration-500 max-w-5xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Key size={22} className="text-purple-400" />
            API Keys
          </h1>
          <p className="text-sm text-[#8892AA] mt-1">Programmatic access to your workspace. Keys are scoped and can be revoked at any time.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-xl text-sm font-semibold hover:bg-slate-100 transition-colors shrink-0"
        >
          <Plus size={16} />
          Create Key
        </button>
      </div>

      <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="space-y-px">
            {[1, 2, 3].map(i => <div key={i} className="h-16 bg-white/[0.02] animate-pulse" />)}
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center gap-3 py-12">
            <AlertCircle size={18} className="text-red-400" />
            <p className="text-sm text-red-400">Failed to load API keys.</p>
          </div>
        ) : keys.length === 0 ? (
          <div className="p-14 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.04] flex items-center justify-center mb-4">
              <Key size={24} className="text-[#4A5168]" />
            </div>
            <p className="text-base font-semibold text-[#F1F3F9] mb-1">No API keys</p>
            <p className="text-sm text-[#4A5168] mb-6 max-w-sm">
              Create a key to access Clarity programmatically. You control which resources each key can access through granular scopes.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              Create your first key
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  {['Name', 'Key', 'Scopes', 'Last Used', 'Expires', ''].map(h => (
                    <th key={h || 'action'} className="px-5 py-3 text-left font-bold text-[#4A5168] uppercase tracking-wider whitespace-nowrap last:text-right">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {keys.map(key => <ApiKeyRow key={key.id} apiKey={key} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-6 p-5 rounded-2xl bg-blue-500/[0.07] border border-blue-500/20 flex gap-4">
        <Shield size={18} className="text-blue-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue-400 mb-1">Key Security</p>
          <p className="text-xs text-[#8892AA] leading-relaxed">
            API keys are only shown once at creation. Keys carry your workspace permissions — never commit them to version control.
            Revoked keys stop working immediately. All key usage is recorded in Audit Logs.
          </p>
        </div>
      </div>

      <AnimatePresence>
        {showCreate && <CreateKeyModal onClose={() => setShowCreate(false)} />}
      </AnimatePresence>
    </div>
  );
}
