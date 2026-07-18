'use client';

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  CheckCircle2,
  Coins,
  Cpu,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Square,
  Wrench,
  XCircle,
} from 'lucide-react';
import { useApiAuth } from '@/contexts/useApiAuth';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useQueryClient } from '@tanstack/react-query';
import {
  triggerAgentRunStreaming,
  approveAgentRun,
  rejectAgentRun,
  cancelAgentRun,
  getAgent,
} from '@/lib/api';
import {
  createAgentStreamState,
  applyAgentStreamEvent,
  type AgentStreamState,
} from '@/lib/agentStream';
import { cn } from '@/lib/cn';
import { useToast } from '@/contexts/ToastContext';
import { PremiumBackground } from '@/components/landing/PremiumBackground';

export default function LiveAgentPage({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = use(params);
  const auth = useApiAuth();
  const { activeWorkspace } = useWorkspace();
  const { toast } = useToast();
  const qc = useQueryClient();
  const workspaceId = activeWorkspace?.id;
  const [state, setState] = useState<AgentStreamState>(createAgentStreamState());
  const [agentName, setAgentName] = useState<string>('');
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const abortRef = useRef<(() => void) | null>(null);

  // Load agent name
  useEffect(() => {
    if (!auth.ready) return;
    void (async () => {
      try {
        const a = await auth.getAuth();
        const fetched = await getAgent(a, agentId);
        setAgentName(fetched.name);
        // Auto-run if `?run=1` is in the URL
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          if (params.get('run') === '1') {
            setInput(params.get('q') || '');
          }
        }
      } catch (err) {
        // ignore — page will just render without a name
      }
    })();
  }, [auth, agentId]);

  const onEvent = useCallback((event: Parameters<typeof applyAgentStreamEvent>[1]) => {
    setState((s) => applyAgentStreamEvent(s, event));
  }, []);

  const submit = useCallback(async () => {
    if (!input.trim() || submitting) return;
    if (!auth.ready) {
      const reason =
        auth.error === 'not_signed_in'
          ? 'You must be signed in to run an agent.'
          : auth.error === 'no_workspace'
            ? 'Select a workspace to run an agent.'
            : 'Loading your session…';
      setAuthError(reason);
      toast.error(reason);
      return;
    }
    setAuthError(null);
    setSubmitting(true);
    setState(createAgentStreamState());
    try {
      const resolvedAuth = await auth.getAuth();
      const { abort } = await triggerAgentRunStreaming(resolvedAuth, agentId, {
        input: input.trim(),
        onEvent,
        onComplete: () => {
          setSubmitting(false);
          // Refresh agent runs and the agent's analytics so the detail
          // page shows the new run immediately when the user navigates back.
          void qc.invalidateQueries({ queryKey: ['agent-runs', workspaceId, agentId] });
          void qc.invalidateQueries({ queryKey: ['agent-analytics', workspaceId, agentId] });
          void qc.invalidateQueries({ queryKey: ['agents', workspaceId] });
        },
        onError: (err) => {
          setSubmitting(false);
          toast.error(err.message || 'Run failed.');
        },
      });
      abortRef.current = abort;
    } catch (err) {
      setSubmitting(false);
      const message = err instanceof Error ? err.message : 'Failed to start run.';
      setAuthError(message);
      toast.error(message);
    }
  }, [input, submitting, auth, agentId, onEvent, toast, qc, workspaceId]);

  const cancel = useCallback(async () => {
    if (!state.runId) return;
    if (!auth.ready) return;
    abortRef.current?.();
    try {
      const resolvedAuth = await auth.getAuth();
      await cancelAgentRun(resolvedAuth, state.runId);
      toast.success('Run cancelled.');
    } catch (err) {
      // best-effort
    }
  }, [auth, state.runId, toast]);

  const approve = useCallback(async () => {
    if (!state.runId || !auth.ready) return;
    try {
      const resolvedAuth = await auth.getAuth();
      await approveAgentRun(resolvedAuth, state.runId);
      toast.success('Run approved.');
    } catch (err) {
      toast.error('Failed to approve.');
    }
  }, [auth, state.runId, toast]);

  const reject = useCallback(async () => {
    if (!state.runId || !auth.ready) return;
    try {
      const resolvedAuth = await auth.getAuth();
      await rejectAgentRun(resolvedAuth, state.runId, 'rejected via console');
      toast.success('Run rejected.');
    } catch (err) {
      toast.error('Failed to reject.');
    }
  }, [auth, state.runId, toast]);

  const workspaceName = activeWorkspace?.name ?? 'No workspace';

  return (
    <div className="relative min-h-screen px-6 py-8">
      <PremiumBackground />
      <div className="relative mx-auto max-w-7xl space-y-6">
        <Link
          href={`/agents/${agentId}`}
          className="inline-flex items-center gap-1 text-xs text-fg-muted transition-colors hover:text-fg-primary"
        >
          <ArrowLeft className="h-3 w-3" /> Back to agent
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-fg-primary">{agentName || 'Live run'}</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Autonomous execution with full streaming, verification, and observability.
            <span className="ml-2 text-fg-muted/70">· {workspaceName}</span>
          </p>
        </div>

        {/* Auth/workspace warning banner */}
        {authError && !auth.ready && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-amber-400"
          >
            <XCircle className="h-4 w-4" />
            {authError}
          </motion.div>
        )}

        {/* Prompt composer */}
        <div className="rounded-2xl border border-white/[0.06] bg-surface-elevated p-4">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe what you want the agent to do…"
            disabled={submitting}
            className="w-full resize-none rounded-lg border border-white/[0.06] bg-black/30 p-3 text-sm text-fg-primary placeholder:text-fg-muted focus:border-accent/50 focus:outline-none disabled:opacity-50"
            rows={3}
          />
          <div className="mt-3 flex items-center gap-2">
            {!submitting ? (
              <button
                type="button"
                onClick={submit}
                disabled={!input.trim() || !auth.ready}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
              >
                <Play className="h-3.5 w-3.5" /> Run
              </button>
            ) : (
              <button
                type="button"
                onClick={cancel}
                className="inline-flex items-center gap-1.5 rounded-lg bg-danger/15 px-3 py-1.5 text-sm font-medium text-danger transition-colors hover:bg-danger/25"
              >
                <Square className="h-3.5 w-3.5" /> Cancel
              </button>
            )}
            {!auth.ready && (
              <span className="inline-flex items-center gap-1 text-xs text-fg-muted">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading session…
              </span>
            )}
          </div>
        </div>

        {/* Run header (counters) */}
        {state.runId && (
          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/[0.06] bg-surface-elevated p-4 md:grid-cols-6">
            <Stat label="Status" value={state.status ?? '—'} icon={state.status === 'completed' ? CheckCircle2 : Loader2} />
            <Stat label="Plan steps" value={state.plan.length} icon={Wrench} />
            <Stat label="Nodes" value={Object.keys(state.nodes).length} icon={Cpu} />
            <Stat
              label="Trust"
              value={state.trustScore === null ? '—' : state.trustScore.toFixed(3)}
              icon={ShieldCheck}
            />
            <Stat
              label="Tokens"
              value={state.totalTokensIn + state.totalTokensOut}
              icon={Cpu}
            />
            <Stat label="Cost" value={`$${state.totalCostUsd.toFixed(4)}`} icon={Coins} />
          </div>
        )}

        {/* Plan */}
        {state.plan.length > 0 && <PlanCard plan={state.plan} currentIndex={state.currentStepIndex} />}

        {/* Trust + abstention */}
        {(state.trustScore !== null || state.abstained) && (
          <div
            className={cn(
              'rounded-2xl border p-4',
              state.abstained ? 'border-warning/30 bg-warning/5' : 'border-white/[0.06] bg-surface-elevated',
            )}
          >
            <div className="flex items-center gap-3">
              {state.abstained ? (
                <XCircle className="h-5 w-5 text-warning" />
              ) : (
                <ShieldCheck className="h-5 w-5 text-success" />
              )}
              <div>
                <div className="text-sm font-semibold text-fg-primary">
                  {state.abstained ? 'Abstention' : `Calibrated trust: ${state.trustScore?.toFixed(3)}`}
                </div>
                {state.abstentionReason && (
                  <div className="mt-0.5 text-xs text-fg-secondary">{state.abstentionReason}</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Approval */}
        <AnimatePresence>
          {state.status === 'awaiting_approval' && state.approvalId && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex items-center justify-between rounded-2xl border border-warning/30 bg-warning/5 p-4"
            >
              <div className="flex items-center gap-2 text-warning">
                <Pause className="h-4 w-4" />
                <span className="text-sm font-medium">Awaiting human approval</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={reject}
                  className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-1.5 text-sm text-danger transition-colors hover:bg-danger/20"
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={approve}
                  className="rounded-lg bg-success px-3 py-1.5 text-sm text-white transition-colors hover:bg-success/90"
                >
                  Approve
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Final output */}
        {state.output && (
          <div className="rounded-2xl border border-white/[0.06] bg-surface-elevated p-4">
            <h3 className="mb-2 text-sm font-semibold text-fg-primary">Output</h3>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap text-sm text-fg-secondary">
              {state.output}
            </pre>
          </div>
        )}

        {/* Tool calls (live) */}
        {state.toolCalls.length > 0 && (
          <div className="rounded-2xl border border-white/[0.06] bg-surface-elevated p-4">
            <h3 className="mb-3 text-sm font-semibold text-fg-primary">
              Tool calls <span className="text-fg-muted">({state.toolCalls.length})</span>
            </h3>
            <ul className="space-y-1.5 text-xs">
              {state.toolCalls.map((tc) => (
                <li
                  key={tc.id}
                  className={cn(
                    'flex items-center gap-2 rounded-md border px-2 py-1.5',
                    tc.status === 'success' ? 'border-white/[0.06] bg-black/20' : 'border-danger/30 bg-danger/5',
                  )}
                >
                  <Wrench className="h-3 w-3 text-accent" />
                  <span className="text-fg-primary">{tc.tool}</span>
                  {tc.retryCount > 0 && (
                    <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[10px] text-warning">
                      retry ×{tc.retryCount}
                    </span>
                  )}
                  <span className="ml-auto text-fg-muted">{tc.latencyMs} ms</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Memory (live preview) */}
        {state.memoryEntries.length > 0 && (
          <div className="rounded-2xl border border-white/[0.06] bg-surface-elevated p-4">
            <h3 className="mb-2 text-sm font-semibold text-fg-primary">
              Memory <span className="text-fg-muted">({state.memoryEntries.length})</span>
            </h3>
            <ul className="space-y-1 text-xs">
              {state.memoryEntries.slice(-6).map((e) => (
                <li key={e.id} className="rounded bg-black/20 p-2">
                  <div className="text-[10px] uppercase text-fg-muted">{e.role}</div>
                  <div className="text-fg-secondary">{e.content.slice(0, 200)}</div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Error */}
        {state.errorMessage && (
          <div className="flex items-center gap-2 rounded-2xl border border-danger/30 bg-danger/5 p-4 text-danger">
            <XCircle className="h-4 w-4" /> {state.errorMessage}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Cpu }) {
  return (
    <div className="flex items-center gap-2">
      <div className="rounded-lg bg-white/[0.04] p-2">
        <Icon className="h-4 w-4 text-accent" />
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wider text-fg-muted">{label}</div>
        <div className="text-sm font-medium text-fg-primary">{value}</div>
      </div>
    </div>
  );
}

function PlanCard({
  plan,
  currentIndex,
}: {
  plan: Array<{ id: string; description: string; tool: string | null; status: string }>;
  currentIndex: number;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-surface-elevated p-4">
      <h3 className="mb-3 text-sm font-semibold text-fg-primary">Plan</h3>
      <ol className="space-y-1.5 text-xs">
        {plan.map((step, i) => {
          const isCurrent = i === currentIndex && step.status === 'running';
          const isDone = step.status === 'success' || i < currentIndex;
          return (
            <li
              key={step.id}
              className={cn(
                'flex items-center gap-2 rounded-md border px-2 py-1.5',
                isCurrent
                  ? 'border-accent/30 bg-accent/5'
                  : isDone
                    ? 'border-white/[0.06] bg-black/20'
                    : 'border-white/[0.04] bg-black/10',
              )}
            >
              {step.status === 'success' ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              ) : isCurrent ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
              ) : step.status === 'error' ? (
                <XCircle className="h-3.5 w-3.5 text-danger" />
              ) : (
                <span className="h-3.5 w-3.5 rounded-full border border-white/[0.12]" />
              )}
              <span className="text-fg-primary">{step.description}</span>
              {step.tool && <span className="text-[10px] text-fg-muted">({step.tool})</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
