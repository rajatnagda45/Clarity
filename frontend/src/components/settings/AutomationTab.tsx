'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Plus, Trash2, ToggleLeft, ToggleRight, AlertCircle, Play } from 'lucide-react';
import { useAutomationRules, useCreateAutomationRule, useToggleAutomationRule, useDeleteAutomationRule } from '@/hooks/useEnterprise';
import { useToast } from '@/contexts/ToastContext';
import { formatRelativeTime } from '@/lib/time';
import type { AutomationRule } from '@/types/clarity';

const TRIGGER_OPTIONS = [
  { value: 'document.uploaded', label: 'Document Uploaded' },
  { value: 'document.indexed', label: 'Document Indexed' },
  { value: 'trust.score.low', label: 'Trust Score Drops Below Threshold' },
  { value: 'eval.completed', label: 'Evaluation Completed' },
  { value: 'benchmark.completed', label: 'Benchmark Completed' },
  { value: 'member.added', label: 'Member Added' },
  { value: 'schedule.daily', label: 'Daily Schedule' },
  { value: 'schedule.weekly', label: 'Weekly Schedule' },
];

const ACTION_TEMPLATES = [
  { value: 'send_webhook', label: 'Send Webhook' },
  { value: 'send_email', label: 'Send Email Notification' },
  { value: 'add_to_collection', label: 'Add Document to Collection' },
  { value: 'tag_document', label: 'Tag Document' },
  { value: 'run_eval', label: 'Run Evaluation' },
  { value: 'create_audit_log', label: 'Create Audit Log Entry' },
];

function CreateRuleModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const create = useCreateAutomationRule();
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState('');
  const [selectedActions, setSelectedActions] = useState<string[]>([]);

  const toggleAction = (a: string) =>
    setSelectedActions(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);

  const handleCreate = () => {
    if (!name.trim()) { toast.error('Rule name is required.'); return; }
    if (!triggerType) { toast.error('Select a trigger.'); return; }
    if (selectedActions.length === 0) { toast.error('Select at least one action.'); return; }
    create.mutate(
      {
        name: name.trim(),
        trigger_type: triggerType,
        condition: {},
        actions: selectedActions.map(a => ({ type: a })),
      },
      {
        onSuccess: () => { toast.success('Rule created.'); onClose(); },
        onError: () => toast.error('Failed to create rule.'),
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
        <h2 className="text-base font-bold text-[#F1F3F9] mb-5">Create Automation Rule</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#8892AA] mb-1.5">Rule Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Alert on low trust score"
              className="w-full bg-[#151923] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-[#F1F3F9] placeholder:text-[#4A5168] focus:outline-none focus:border-purple-500/50 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#8892AA] mb-1.5">
              Trigger — <span className="font-normal italic">When this happens…</span>
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              {TRIGGER_OPTIONS.map(t => (
                <button
                  key={t.value}
                  onClick={() => setTriggerType(t.value)}
                  className={`text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${
                    triggerType === t.value
                      ? 'bg-purple-500/15 border-purple-500/30 text-purple-300'
                      : 'bg-white/[0.02] border-white/[0.06] text-[#4A5168] hover:text-[#8892AA]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#8892AA] mb-1.5">
              Actions — <span className="font-normal italic">Then do this…</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {ACTION_TEMPLATES.map(a => (
                <button
                  key={a.value}
                  onClick={() => toggleAction(a.value)}
                  className={`text-left px-3 py-2 rounded-lg text-[11px] font-medium transition-colors border ${
                    selectedActions.includes(a.value)
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : 'bg-white/[0.02] border-white/[0.06] text-[#4A5168] hover:text-[#8892AA]'
                  }`}
                >
                  {a.label}
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
            {create.isPending ? 'Creating…' : 'Create Rule'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function RuleCard({ rule }: { rule: AutomationRule }) {
  const { toast } = useToast();
  const toggle = useToggleAutomationRule();
  const remove = useDeleteAutomationRule();
  const triggerLabel = TRIGGER_OPTIONS.find(t => t.value === rule.triggerType)?.label ?? rule.triggerType;

  return (
    <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-4 hover:border-white/[0.1] transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-semibold text-[#F1F3F9] truncate">{rule.name}</p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${rule.enabled ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/[0.04] text-[#4A5168]'}`}>
              {rule.enabled ? 'Active' : 'Paused'}
            </span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wide text-[#4A5168]">When</span>
            <span className="text-[11px] text-purple-400 font-mono font-semibold bg-purple-500/10 px-2 py-0.5 rounded-md">{triggerLabel}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wide text-[#4A5168]">Then</span>
            {rule.actions.map((a, i) => {
              const actionType = String(a['type'] ?? '');
              return (
                <span key={i} className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                  {ACTION_TEMPLATES.find(t => t.value === actionType)?.label ?? actionType}
                </span>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => toggle.mutate(rule.id)}
            className="p-1.5 rounded-lg text-[#4A5168] hover:text-[#F1F3F9] hover:bg-white/[0.06] transition-colors"
          >
            {rule.enabled ? <ToggleRight size={18} className="text-emerald-400" /> : <ToggleLeft size={18} />}
          </button>
          <button
            onClick={() => remove.mutate(rule.id, {
              onSuccess: () => toast.success('Rule deleted.'),
              onError: () => toast.error('Failed to delete.'),
            })}
            className="p-1.5 rounded-lg text-[#4A5168] hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-white/[0.04] flex items-center gap-4 text-[10px] text-[#4A5168]">
        <span className="flex items-center gap-1">
          <Play size={9} />
          {rule.runCount} runs
        </span>
        {rule.lastRunAt && (
          <span>Last run {formatRelativeTime(rule.lastRunAt)}</span>
        )}
      </div>
    </div>
  );
}

export function AutomationTab() {
  const { data, isLoading, isError } = useAutomationRules();
  const [showCreate, setShowCreate] = useState(false);
  const rules = data?.rules ?? [];
  const active = rules.filter(r => r.enabled).length;

  return (
    <div className="flex flex-col animate-in fade-in duration-500 max-w-4xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Zap size={22} className="text-purple-400" />
            Automation
          </h1>
          <p className="text-sm text-[#8892AA] mt-1">Build trigger-based rules to automate workflows across your workspace.</p>
        </div>
        <div className="flex items-center gap-3">
          {active > 0 && (
            <span className="text-xs font-semibold text-emerald-400">{active} active</span>
          )}
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-xl text-sm font-semibold hover:bg-slate-100 transition-colors shrink-0"
          >
            <Plus size={16} />
            New Rule
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-32 bg-white/[0.03] border border-white/[0.04] rounded-2xl animate-pulse" />)}
        </div>
      )}

      {isError && (
        <div className="flex items-center justify-center gap-3 py-12 bg-[#0F1117] border border-white/[0.06] rounded-2xl">
          <AlertCircle size={18} className="text-red-400" />
          <p className="text-sm text-red-400">Failed to load automation rules.</p>
        </div>
      )}

      {!isLoading && !isError && rules.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 bg-[#0F1117] border border-white/[0.06] rounded-2xl text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.04] flex items-center justify-center mb-4">
            <Zap size={24} className="text-[#4A5168]" />
          </div>
          <p className="text-base font-semibold text-[#F1F3F9] mb-1">No automation rules</p>
          <p className="text-sm text-[#4A5168] mb-6 max-w-sm">
            Create rules that automatically respond to events — like sending alerts when trust scores drop or tagging documents on upload.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            Create your first rule
          </button>
        </div>
      )}

      {!isLoading && !isError && rules.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rules.map(rule => <RuleCard key={rule.id} rule={rule} />)}
        </div>
      )}

      <AnimatePresence>
        {showCreate && <CreateRuleModal onClose={() => setShowCreate(false)} />}
      </AnimatePresence>
    </div>
  );
}
