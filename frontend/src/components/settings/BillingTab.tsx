'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@clerk/nextjs';
import {
  CreditCard, Sparkles, Receipt, Zap, ShieldCheck,
  CheckCircle2, Clock, HardDrive, FileText, MessageSquare,
  Plus, Loader2, X, Check, Mail, Building2
} from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useDocuments } from '@/hooks/useDocuments';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { useToast } from '@/contexts/ToastContext';
import { ProgressBar } from '@/components/ds/Progress';
import { createCheckoutSession, createPortalSession } from '@/lib/api';
import { formatBytes } from '@/lib/format';

// ---------------------------------------------------------------------------
// Pricing data — matches the landing page exactly
// ---------------------------------------------------------------------------

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    dbName: 'free',
    desc: 'For personal projects',
    priceMonthly: 0,
    priceYearly: 0,
    features: [
      '50 document uploads',
      'AI Chat',
      'Citations',
      'Verification',
      'Basic Analytics',
    ],
    cta: 'Start Free',
    popular: false,
    isEnterprise: false,
    storage: 50 * 1024 * 1024,
    queries: 100,
    seats: 1,
  },
  {
    id: 'pro',
    name: 'Pro',
    dbName: 'pro',
    desc: 'For professionals and small teams',
    priceMonthly: 19,
    priceYearly: 15,
    features: [
      'Unlimited documents',
      'Priority processing',
      'Collections',
      'Advanced AI Chat',
      'Evidence Explorer',
      'Citation Highlighting',
      'Trust Score',
      'Analytics',
      'Export',
      'API Access',
    ],
    cta: 'Upgrade to Pro',
    popular: true,
    isEnterprise: false,
    storage: 5 * 1024 * 1024 * 1024,
    queries: 5000,
    seats: 5,
  },
  {
    id: 'team',
    name: 'Business',
    dbName: 'team',
    desc: 'For growing organizations',
    priceMonthly: 79,
    priceYearly: 63,
    features: [
      'Everything in Pro',
      'Team Workspaces',
      'Role Permissions',
      'Shared Collections',
      'SSO',
      'Audit Logs',
      'Usage Analytics',
      'Higher API limits',
      'Priority Support',
    ],
    cta: 'Upgrade to Business',
    popular: false,
    isEnterprise: false,
    storage: 20 * 1024 * 1024 * 1024,
    queries: 25000,
    seats: 20,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    dbName: 'enterprise',
    desc: 'For large scale deployments',
    priceMonthly: null,
    priceYearly: null,
    features: [
      'Unlimited Everything',
      'Dedicated Infrastructure',
      'SOC2',
      'Private Deployments',
      'Custom Integrations',
      'SLA',
      'Dedicated Support',
      'White-label',
    ],
    cta: 'Book Demo',
    popular: false,
    isEnterprise: true,
    storage: Infinity,
    queries: Infinity,
    seats: Infinity,
  },
];

// ---------------------------------------------------------------------------
// Checkout modal
// ---------------------------------------------------------------------------

function UpgradeModal({
  open,
  onClose,
  plan,
  isYearly,
  workspaceId,
}: {
  open: boolean;
  onClose: () => void;
  plan: typeof PLANS[number];
  isYearly: boolean;
  workspaceId: string;
}) {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const price = isYearly ? plan.priceYearly : plan.priceMonthly;
  const period = isYearly ? 'yearly' : 'monthly';

  async function handleCheckout() {
    setLoading(true);
    setError('');
    try {
      const token = await getToken();
      if (!token) throw new Error('Session token unavailable.');
      const successUrl = `${window.location.origin}/billing?checkout=success`;
      const cancelUrl = `${window.location.origin}/billing`;
      const { url } = await createCheckoutSession(
        { token, workspaceId },
        plan.dbName,
        successUrl,
        cancelUrl,
        period,
      );
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed. Please try again.');
      setLoading(false);
    }
  }

  if (!open) return null;
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-[#05070B]/80 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-lg bg-[#0F1117] border border-white/[0.08] rounded-[24px] shadow-2xl overflow-hidden p-8"
        >
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-4">
                <Sparkles size={24} className="text-orange-400" />
              </div>
              <h2 className="text-2xl font-bold text-[#F1F3F9]">Upgrade to {plan.name}</h2>
              <p className="text-sm text-[#8892AA] mt-1">
                ${price}/{isYearly ? 'mo billed annually' : 'month'}
              </p>
            </div>
            <button onClick={onClose} className="p-2 text-[#4A5168] hover:text-[#F1F3F9] transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="bg-[#05070B] border border-white/[0.06] rounded-xl p-5 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <CreditCard size={18} className="text-orange-400 shrink-0" />
              <p className="text-sm font-medium text-[#F1F3F9]">Secure checkout via Dodo Payments</p>
            </div>
            <ul className="space-y-2">
              {plan.features.slice(0, 4).map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-[#8892AA]">
                  <Check size={13} className="text-orange-400 shrink-0" />
                  {f}
                </li>
              ))}
              {plan.features.length > 4 && (
                <li className="text-xs text-[#4A5168] pl-5">+{plan.features.length - 4} more</li>
              )}
            </ul>
          </div>

          {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-[#8892AA] hover:text-[#F1F3F9] hover:bg-white/[0.04] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCheckout}
              disabled={loading}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-orange-500 text-white hover:bg-orange-600 shadow-[0_0_20px_rgba(249,115,22,0.3)] transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> Redirecting…</>
              ) : (
                <><Zap size={16} /> Continue to Checkout</>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Enterprise contact modal
// ---------------------------------------------------------------------------

function EnterpriseModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  function handleBookDemo() {
    const subject = encodeURIComponent('Enterprise Inquiry — Clarity AI Docs');
    const body = encodeURIComponent(
      `Hi,\n\nI'm interested in Clarity AI Docs Enterprise.\n\nCompany: \nTeam size: \nUse case: \n\nPlease get back to me to arrange a demo.\n\nThanks`
    );
    window.open(`mailto:enterprise@clarity.ai?subject=${subject}&body=${body}`, '_blank');
    onClose();
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-[#05070B]/80 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-lg bg-[#0F1117] border border-white/[0.08] rounded-[24px] shadow-2xl overflow-hidden p-8"
        >
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4">
                <Building2 size={24} className="text-purple-400" />
              </div>
              <h2 className="text-2xl font-bold text-[#F1F3F9]">Enterprise Plan</h2>
              <p className="text-sm text-[#8892AA] mt-1">Custom pricing for large-scale deployments.</p>
            </div>
            <button onClick={onClose} className="p-2 text-[#4A5168] hover:text-[#F1F3F9] transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="bg-[#05070B] border border-white/[0.06] rounded-xl p-5 mb-6">
            <ul className="space-y-2.5">
              {['Unlimited Everything', 'Dedicated Infrastructure', 'SOC2', 'Private Deployments', 'Custom Integrations', 'SLA', 'Dedicated Support', 'White-label'].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-[#8892AA]">
                  <Check size={13} className="text-purple-400 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4 mb-6 flex items-start gap-3">
            <Mail size={16} className="text-purple-400 mt-0.5 shrink-0" />
            <p className="text-sm text-[#8892AA]">
              Clicking Book Demo will open your email client with a pre-filled inquiry to our team.
              We typically respond within 24 hours.
            </p>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-[#8892AA] hover:text-[#F1F3F9] hover:bg-white/[0.04]"
            >
              Cancel
            </button>
            <button
              onClick={handleBookDemo}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-purple-500 text-white hover:bg-purple-600 shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all flex items-center gap-2"
            >
              <Mail size={16} /> Book Demo
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Main BillingTab
// ---------------------------------------------------------------------------

export function BillingTab() {
  const { activeWorkspace } = useWorkspace();
  const { getToken } = useAuth();
  const { toast } = useToast();
  const { data: documents } = useDocuments();
  const { devDashboard, answerMetrics } = useDashboardMetrics();

  const [isYearly, setIsYearly] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<typeof PLANS[number]>(PLANS[1]);
  const [enterpriseModalOpen, setEnterpriseModalOpen] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  async function handleManageSubscription() {
    if (!activeWorkspace) return;
    setPortalLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Session unavailable.');
      const { url } = await createPortalSession({ token, workspaceId: activeWorkspace.id }, window.location.href);
      window.location.href = url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to open billing portal.');
      setPortalLoading(false);
    }
  }

  function handlePlanCta(plan: typeof PLANS[number]) {
    if (plan.isEnterprise) {
      setEnterpriseModalOpen(true);
      return;
    }
    if (plan.dbName === 'free') return; // already free
    setSelectedPlan(plan);
    setUpgradeModalOpen(true);
  }

  const currentPlanObj = PLANS.find(p => p.dbName === (activeWorkspace?.plan ?? 'free')) ?? PLANS[0];
  const storageUsed = devDashboard.data?.totalStorageBytes ?? null;
  const storagePct = storageUsed != null && currentPlanObj.storage !== Infinity
    ? Math.min(100, Math.round((storageUsed / currentPlanObj.storage) * 100))
    : null;
  const queries = answerMetrics.data?.conversationsCreated ?? 0;
  const queriesPct = currentPlanObj.queries !== Infinity
    ? Math.min(100, Math.round((queries / currentPlanObj.queries) * 100))
    : 0;
  const docs = documents?.length ?? 0;

  return (
    <div className="flex flex-col animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#F1F3F9] tracking-tight">Billing & Subscription</h1>
          <p className="text-sm text-[#8892AA] mt-1">
            {activeWorkspace
              ? `Manage your plan and usage for ${activeWorkspace.name}`
              : 'Choose a plan to unlock the full power of Clarity AI Docs'}
          </p>
        </div>
      </div>

      {/* Current plan card — only when a workspace is active */}
      {activeWorkspace && (
        <div className="bg-[#0F1117] border border-orange-500/20 rounded-[28px] p-8 mb-8 relative overflow-hidden shadow-[0_0_40px_rgba(249,115,22,0.06)]">
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/8 blur-[80px] rounded-full pointer-events-none" />
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center relative z-10">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="px-3 py-1 rounded-md text-xs font-bold tracking-wider uppercase bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.4)]">
                  {currentPlanObj.name} Plan
                </span>
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                  <CheckCircle2 size={10} /> Active
                </span>
              </div>
              <h2 className="text-3xl font-bold text-[#F1F3F9]">
                {currentPlanObj.priceMonthly !== null
                  ? <>${currentPlanObj.priceMonthly} <span className="text-lg text-[#8892AA] font-normal">/ month</span></>
                  : 'Custom'}
              </h2>
              <p className="text-sm text-[#8892AA] mt-2 flex items-center gap-1.5">
                <Clock size={14} />
                Manage renewal via the billing portal
              </p>
            </div>
            <div className="mt-6 md:mt-0 flex gap-3">
              <button
                onClick={handleManageSubscription}
                disabled={portalLoading}
                className="px-5 py-2.5 rounded-xl text-sm font-medium bg-white/[0.04] border border-white/[0.08] text-[#F1F3F9] hover:bg-white/[0.08] transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {portalLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                Manage Subscription
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Monthly / Yearly toggle */}
      <div className="flex items-center justify-center mb-8 gap-4">
        <span className={`text-sm font-medium ${!isYearly ? 'text-[#F1F3F9]' : 'text-[#4A5168]'}`}>Monthly</span>
        <button
          onClick={() => setIsYearly(!isYearly)}
          className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${isYearly ? 'bg-orange-500' : 'bg-white/10'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200 ${isYearly ? 'translate-x-6' : 'translate-x-0'}`} />
        </button>
        <span className={`text-sm font-medium ${isYearly ? 'text-[#F1F3F9]' : 'text-[#4A5168]'}`}>
          Yearly
          <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-500/15 text-orange-400 border border-orange-500/20">
            Save 20%
          </span>
        </span>
      </div>

      {/* Plan cards — 4 plans matching landing page */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
        {PLANS.map((plan) => {
          const isCurrent = plan.dbName === (activeWorkspace?.plan ?? 'free');
          const price = isYearly ? plan.priceYearly : plan.priceMonthly;
          const isDisabled = isCurrent || plan.dbName === 'free';

          return (
            <div
              key={plan.id}
              className={`relative bg-[#0F1117] border rounded-2xl p-6 flex flex-col transition-all ${
                plan.popular
                  ? 'border-orange-500/40 shadow-[0_0_30px_rgba(249,115,22,0.1)]'
                  : isCurrent
                  ? 'border-emerald-500/30'
                  : 'border-white/[0.06] hover:border-white/[0.12]'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-gradient-to-r from-orange-500 to-orange-600 text-white text-[10px] font-bold uppercase tracking-wider py-1 px-3 rounded-full shadow-[0_0_15px_rgba(249,115,22,0.5)] border border-orange-400/50 whitespace-nowrap">
                    Most Popular
                  </span>
                </div>
              )}

              <h3 className="text-base font-bold text-[#F1F3F9] mt-2">{plan.name}</h3>
              <p className="text-xs text-[#4A5168] mt-1 mb-4">{plan.desc}</p>

              <div className="mb-5">
                {price === null ? (
                  <span className="text-3xl font-extrabold text-[#F1F3F9]">Custom</span>
                ) : (
                  <>
                    <span className="text-3xl font-extrabold text-[#F1F3F9]">${price}</span>
                    <span className="text-[#4A5168] text-sm">/mo</span>
                  </>
                )}
                {price !== null && price > 0 && (
                  <p className="text-[10px] text-orange-400/70 mt-1 uppercase tracking-wider font-medium">
                    {isYearly ? 'billed annually' : 'billed monthly'}
                  </p>
                )}
              </div>

              <ul className="flex-1 space-y-2.5 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-[#8892AA]">
                    <Check size={12} className={`mt-0.5 shrink-0 ${plan.popular ? 'text-orange-400' : 'text-emerald-400'}`} />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handlePlanCta(plan)}
                disabled={isDisabled && !plan.isEnterprise}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isCurrent
                    ? 'bg-white/[0.04] text-[#8892AA] cursor-default border border-white/[0.08]'
                    : plan.popular
                    ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:shadow-[0_0_20px_rgba(249,115,22,0.3)]'
                    : plan.isEnterprise
                    ? 'bg-purple-500/10 text-purple-300 border border-purple-500/20 hover:bg-purple-500/20'
                    : 'bg-white/[0.04] text-[#F1F3F9] border border-white/[0.08] hover:bg-white/[0.08]'
                }`}
              >
                {isCurrent ? 'Current Plan' : plan.cta}
              </button>
            </div>
          );
        })}
      </div>

      {/* Current usage — only when workspace is active */}
      {activeWorkspace && (
        <>
          <h2 className="text-lg font-bold text-[#F1F3F9] mb-4">Current Usage</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-12">
            <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-6">
              <div className="flex justify-between items-center mb-5">
                <div className="flex items-center gap-2 text-[#8892AA]">
                  <HardDrive size={15} />
                  <span className="text-sm font-medium">Vector Storage</span>
                </div>
                <span className="text-xs font-mono text-[#F1F3F9]">
                  {storageUsed != null ? formatBytes(storageUsed) : '—'} / {currentPlanObj.storage !== Infinity ? formatBytes(currentPlanObj.storage) : '∞'}
                </span>
              </div>
              <ProgressBar value={storagePct ?? 0} size="sm" variant={(storagePct ?? 0) > 80 ? 'error' : (storagePct ?? 0) > 50 ? 'warning' : 'default'} />
              <p className="text-[10px] text-[#4A5168] mt-3 uppercase tracking-wider">
                {storagePct != null ? `${storagePct}% utilized` : 'Unavailable'}
              </p>
            </div>

            <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-6">
              <div className="flex justify-between items-center mb-5">
                <div className="flex items-center gap-2 text-[#8892AA]">
                  <MessageSquare size={15} />
                  <span className="text-sm font-medium">Monthly AI Queries</span>
                </div>
                <span className="text-xs font-mono text-[#F1F3F9]">
                  {queries} / {currentPlanObj.queries !== Infinity ? currentPlanObj.queries.toLocaleString() : '∞'}
                </span>
              </div>
              <ProgressBar value={queriesPct} size="sm" variant={queriesPct > 80 ? 'error' : queriesPct > 50 ? 'warning' : 'default'} />
              <p className="text-[10px] text-[#4A5168] mt-3 uppercase tracking-wider">{queriesPct}% utilized</p>
            </div>

            <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-6">
              <div className="flex justify-between items-center mb-5">
                <div className="flex items-center gap-2 text-[#8892AA]">
                  <FileText size={15} />
                  <span className="text-sm font-medium">Indexed Documents</span>
                </div>
                <span className="text-xs font-mono text-[#F1F3F9]">{docs}</span>
              </div>
              <ProgressBar value={10} size="sm" variant="default" />
              <p className="text-[10px] text-[#4A5168] mt-3 uppercase tracking-wider">Unlimited on {currentPlanObj.name}</p>
            </div>
          </div>
        </>
      )}

      {/* Billing history + payment method */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-6 flex flex-col min-h-[260px]">
          <div className="flex items-center gap-2 mb-6">
            <Receipt size={15} className="text-orange-400" />
            <h2 className="text-sm font-semibold text-[#F1F3F9]">Billing History</h2>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-10 h-10 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-center mb-3">
              <Receipt size={18} className="text-[#4A5168]" />
            </div>
            <h3 className="text-sm font-bold text-[#F1F3F9] mb-1">No Invoices Yet</h3>
            <p className="text-xs text-[#8892AA] max-w-[220px]">
              Your billing history will appear here once you subscribe.
            </p>
          </div>
        </div>

        <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-6 flex flex-col min-h-[260px]">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <CreditCard size={15} className="text-orange-400" />
              <h2 className="text-sm font-semibold text-[#F1F3F9]">Payment Methods</h2>
            </div>
            <button
              onClick={handleManageSubscription}
              disabled={portalLoading}
              className="text-xs font-medium text-orange-400 flex items-center gap-1 hover:text-orange-300 transition-colors disabled:opacity-50"
            >
              <Plus size={13} /> Add Card
            </button>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-10 h-10 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-center mb-3">
              <ShieldCheck size={18} className="text-[#4A5168]" />
            </div>
            <h3 className="text-sm font-bold text-[#F1F3F9] mb-1">Secure Payments</h3>
            <p className="text-xs text-[#8892AA] max-w-[220px]">
              We use Dodo Payments to securely process your payment details.
            </p>
          </div>
        </div>
      </div>

      {/* Modals */}
      <UpgradeModal
        open={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        plan={selectedPlan}
        isYearly={isYearly}
        workspaceId={activeWorkspace?.id ?? ''}
      />
      <EnterpriseModal
        open={enterpriseModalOpen}
        onClose={() => setEnterpriseModalOpen(false)}
      />
    </div>
  );
}
