'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Webhook as WebhookIcon, Plus, Trash2, ToggleLeft, ToggleRight, ChevronDown, ChevronUp, CheckCircle2, XCircle, AlertCircle, Clock } from 'lucide-react';
import { useWebhooks, useCreateWebhook, useDeleteWebhook, useToggleWebhook, useWebhookDeliveries } from '@/hooks/useEnterprise';
import { useToast } from '@/contexts/ToastContext';
import { formatRelativeTime } from '@/lib/time';
import type { Webhook } from '@/types/clarity';

const AVAILABLE_EVENTS = [
  'document.uploaded',
  'document.indexed',
  'document.failed',
  'eval.completed',
  'benchmark.completed',
  'trust.score.low',
  'collection.created',
  'member.added',
  'member.removed',
];

function CreateWebhookModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const create = useCreateWebhook();
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  const toggleEvent = (ev: string) =>
    setSelectedEvents(prev => prev.includes(ev) ? prev.filter(e => e !== ev) : [...prev, ev]);

  const handleCreate = () => {
    if (!url.trim()) { toast.error('Endpoint URL is required.'); return; }
    if (!url.startsWith('https://')) { toast.error('Endpoint must use HTTPS.'); return; }
    if (selectedEvents.length === 0) { toast.error('Select at least one event.'); return; }
    create.mutate(
      { url, description: description || undefined, events: selectedEvents },
      {
        onSuccess: (wh) => {
          toast.success('Webhook created.');
          if (wh.secretPreview) setCreatedSecret(wh.secretPreview);
          else onClose();
        },
        onError: () => toast.error('Failed to create webhook.'),
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        className="bg-[#0F1117] border border-white/[0.1] rounded-2xl p-6 w-full max-w-md shadow-2xl"
      >
        {createdSecret ? (
          <>
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 size={20} className="text-emerald-400" />
              <h2 className="text-base font-bold text-[#F1F3F9]">Webhook Created</h2>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-4">
              <p className="text-xs font-semibold text-amber-400 mb-2">⚠ Save your signing secret — shown only once</p>
              <code className="block text-xs font-mono text-[#F1F3F9] break-all bg-black/30 rounded-lg p-3 select-all">
                {createdSecret}
              </code>
            </div>
            <p className="text-xs text-[#4A5168] mb-5">
              Use this secret to verify incoming webhook payloads. We sign each request with HMAC-SHA256.
            </p>
            <button onClick={onClose} className="w-full py-2.5 bg-white text-black rounded-xl text-sm font-semibold hover:bg-slate-100 transition-colors">
              Done
            </button>
          </>
        ) : (
          <>
            <h2 className="text-base font-bold text-[#F1F3F9] mb-5">Create Webhook</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#8892AA] mb-1.5">Endpoint URL *</label>
                <input
                  type="url"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://your-server.com/webhooks/clarity"
                  className="w-full bg-[#151923] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-[#F1F3F9] placeholder:text-[#4A5168] focus:outline-none focus:border-purple-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#8892AA] mb-1.5">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Optional description"
                  className="w-full bg-[#151923] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-[#F1F3F9] placeholder:text-[#4A5168] focus:outline-none focus:border-purple-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#8892AA] mb-2">Events to subscribe *</label>
                <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                  {AVAILABLE_EVENTS.map(ev => (
                    <button
                      key={ev}
                      onClick={() => toggleEvent(ev)}
                      className={`text-left px-3 py-2 rounded-lg text-[11px] font-mono transition-colors ${
                        selectedEvents.includes(ev)
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-white/[0.03] text-[#4A5168] border border-white/[0.06] hover:text-[#8892AA]'
                      }`}
                    >
                      {ev}
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
                {create.isPending ? 'Creating…' : 'Create Webhook'}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}

function DeliveryStatusIcon({ status }: { status: string }) {
  if (status === 'success') return <CheckCircle2 size={14} className="text-emerald-400" />;
  if (status === 'failure') return <XCircle size={14} className="text-red-400" />;
  return <Clock size={14} className="text-amber-400" />;
}

function WebhookRow({ webhook }: { webhook: Webhook }) {
  const { toast } = useToast();
  const toggle = useToggleWebhook();
  const remove = useDeleteWebhook();
  const [expanded, setExpanded] = useState(false);
  const { data: deliveries } = useWebhookDeliveries(expanded ? webhook.id : '');

  return (
    <div className="border border-white/[0.06] rounded-2xl overflow-hidden">
      <div className="bg-[#0F1117] px-5 py-4 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono font-semibold text-[#F1F3F9] truncate">{webhook.url}</p>
          {webhook.description && (
            <p className="text-xs text-[#4A5168] mt-0.5">{webhook.description}</p>
          )}
          <div className="flex flex-wrap gap-1 mt-2">
            {webhook.events.slice(0, 4).map(ev => (
              <span key={ev} className="text-[9px] font-mono font-bold bg-white/[0.04] text-[#4A5168] px-1.5 py-0.5 rounded-md">{ev}</span>
            ))}
            {webhook.events.length > 4 && (
              <span className="text-[9px] text-[#4A5168]">+{webhook.events.length - 4} more</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${webhook.enabled ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/[0.04] text-[#4A5168]'}`}>
            {webhook.enabled ? 'Active' : 'Paused'}
          </span>
          <button
            onClick={() => toggle.mutate(webhook.id)}
            className="p-1.5 rounded-lg text-[#4A5168] hover:text-[#F1F3F9] hover:bg-white/[0.06] transition-colors"
          >
            {webhook.enabled ? <ToggleRight size={18} className="text-emerald-400" /> : <ToggleLeft size={18} />}
          </button>
          <button
            onClick={() => setExpanded(e => !e)}
            className="p-1.5 rounded-lg text-[#4A5168] hover:text-[#F1F3F9] hover:bg-white/[0.06] transition-colors"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button
            onClick={() => remove.mutate(webhook.id, {
              onSuccess: () => toast.success('Webhook deleted.'),
              onError: () => toast.error('Failed to delete.'),
            })}
            className="p-1.5 rounded-lg text-[#4A5168] hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-white/[0.04]"
          >
            <div className="bg-[#090B11] p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#4A5168] mb-3">Recent Deliveries</p>
              {!deliveries || deliveries.deliveries.length === 0 ? (
                <p className="text-xs text-[#4A5168]">No deliveries yet.</p>
              ) : (
                <div className="space-y-2">
                  {deliveries.deliveries.slice(0, 5).map(d => (
                    <div key={d.id} className="flex items-center gap-3 text-xs">
                      <DeliveryStatusIcon status={d.status} />
                      <span className="font-mono text-[#4A5168]">{d.eventType}</span>
                      {d.responseCode && (
                        <span className={`font-mono font-bold ${d.responseCode < 300 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {d.responseCode}
                        </span>
                      )}
                      {d.latencyMs && <span className="text-[#4A5168]">{d.latencyMs}ms</span>}
                      <span className="text-[#4A5168] ml-auto">{formatRelativeTime(d.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function WebhooksTab() {
  const { data, isLoading, isError } = useWebhooks();
  const [showCreate, setShowCreate] = useState(false);
  const webhooks = data?.webhooks ?? [];

  return (
    <div className="flex flex-col animate-in fade-in duration-500 max-w-4xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <WebhookIcon size={22} className="text-purple-400" />
            Webhooks
          </h1>
          <p className="text-sm text-[#8892AA] mt-1">Send real-time events to your endpoints when key actions happen.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-xl text-sm font-semibold hover:bg-slate-100 transition-colors shrink-0"
        >
          <Plus size={16} />
          Add Webhook
        </button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-20 bg-white/[0.03] border border-white/[0.04] rounded-2xl animate-pulse" />)}
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-3 py-8 text-center bg-[#0F1117] border border-white/[0.06] rounded-2xl justify-center">
          <AlertCircle size={20} className="text-red-400" />
          <p className="text-sm text-[#F1F3F9]">Failed to load webhooks.</p>
        </div>
      )}

      {!isLoading && !isError && webhooks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 bg-[#0F1117] border border-white/[0.06] rounded-2xl text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.04] flex items-center justify-center mb-4">
            <WebhookIcon size={24} className="text-[#4A5168]" />
          </div>
          <p className="text-base font-semibold text-[#F1F3F9] mb-1">No webhooks yet</p>
          <p className="text-sm text-[#4A5168] mb-6 max-w-sm">Create a webhook to receive real-time notifications when documents are indexed, evaluations complete, or trust scores drop.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            Create your first webhook
          </button>
        </div>
      )}

      {!isLoading && !isError && webhooks.length > 0 && (
        <div className="space-y-3">
          {webhooks.map(wh => <WebhookRow key={wh.id} webhook={wh} />)}
        </div>
      )}

      <AnimatePresence>
        {showCreate && <CreateWebhookModal onClose={() => setShowCreate(false)} />}
      </AnimatePresence>
    </div>
  );
}
