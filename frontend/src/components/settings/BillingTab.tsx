'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CreditCard, Sparkles, Receipt, Zap, ShieldCheck, 
  CheckCircle2, Clock, HardDrive, FileText, MessageSquare, Plus, Lock, X
} from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useDocuments } from '@/hooks/useDocuments';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { ProgressBar } from '@/components/ds/Progress';

const PLANS = [
  { name: 'hobby', label: 'Starter', price: '$0', storage: 50 * 1024 * 1024, queries: 100, seats: 1 },
  { name: 'pro', label: 'Pro', price: '$49', storage: 5 * 1024 * 1024 * 1024, queries: 5000, seats: 5 },
  { name: 'business', label: 'Business', price: '$199', storage: 20 * 1024 * 1024 * 1024, queries: 25000, seats: 20 },
];

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function UpgradeModal({ open, onClose, currentPlan }: { open: boolean, onClose: () => void, currentPlan: string }) {
  if (!open) return null;
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-[#05070B]/80 backdrop-blur-sm" />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-2xl bg-[#0F1117] border border-white/[0.08] rounded-[24px] shadow-2xl overflow-hidden p-8"
        >
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4">
                <Sparkles size={24} className="text-purple-400" />
              </div>
              <h2 className="text-2xl font-bold text-[#F1F3F9]">Upgrade to Pro</h2>
              <p className="text-sm text-[#8892AA] mt-1">Unlock higher limits and priority support.</p>
            </div>
            <button onClick={onClose} className="p-2 text-[#4A5168] hover:text-[#F1F3F9] transition-colors"><X size={20} /></button>
          </div>
          <div className="bg-[#05070B] border border-white/[0.06] rounded-xl p-6 mb-8 text-center">
            <CreditCard size={32} className="text-[#4A5168] mx-auto mb-4" />
            <p className="text-[#8892AA] text-sm">Stripe checkout integration is initializing in your environment. You will be able to manage your subscription directly here once complete.</p>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-medium text-[#8892AA] hover:text-[#F1F3F9] hover:bg-white/[0.04]">Cancel</button>
            <button disabled className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-purple-500 text-white opacity-50 cursor-not-allowed flex items-center gap-2">
              <Lock size={16} /> Continue to Checkout
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export function BillingTab() {
  const { activeWorkspace } = useWorkspace();
  const { data: documents } = useDocuments();
  const { devDashboard, answerMetrics } = useDashboardMetrics();
  
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  if (!activeWorkspace) return null;

  const currentPlanObj = PLANS.find(p => p.name === activeWorkspace.plan) || PLANS[0];
  const storageUsed = devDashboard.data?.totalStorageBytes ?? 0;
  const storagePct = Math.min(100, Math.round((storageUsed / currentPlanObj.storage) * 100));
  
  const queries = answerMetrics.data?.conversationsCreated ?? 0;
  const queriesPct = Math.min(100, Math.round((queries / currentPlanObj.queries) * 100));

  const docs = documents?.length ?? 0;

  return (
    <div className="flex flex-col animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#F1F3F9] tracking-tight">Billing & Subscription</h1>
          <p className="text-sm text-[#8892AA] mt-1">Manage plans, usage limits, and invoices for {activeWorkspace.name}</p>
        </div>
      </div>

      <div className="bg-[#0F1117] border border-purple-500/30 rounded-[32px] p-8 mb-8 relative overflow-hidden shadow-[0_0_40px_rgba(168,85,247,0.1)]">
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 blur-[80px] rounded-full pointer-events-none" />
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1 rounded-md text-xs font-bold tracking-wider uppercase bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)]">
                {currentPlanObj.label} Plan
              </span>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                <CheckCircle2 size={10} /> Active
              </span>
            </div>
            <h2 className="text-3xl font-bold text-[#F1F3F9]">{currentPlanObj.price} <span className="text-lg text-[#8892AA] font-normal">/ month</span></h2>
            <p className="text-sm text-[#8892AA] mt-2 flex items-center gap-1.5">
              <Clock size={14} /> Renews on {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}
            </p>
          </div>
          
          <div className="mt-6 md:mt-0 flex gap-3">
            <button className="px-5 py-2.5 rounded-xl text-sm font-medium bg-white/[0.04] border border-white/[0.08] text-[#F1F3F9] hover:bg-white/[0.08] transition-colors">
              Manage Subscription
            </button>
            <button onClick={() => setUpgradeModalOpen(true)} className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-purple-500 text-white hover:bg-purple-600 shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all flex items-center gap-2">
              <Zap size={16} /> Upgrade Plan
            </button>
          </div>
        </div>
      </div>

      <h2 className="text-lg font-bold text-[#F1F3F9] mb-4">Current Usage</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2 text-[#8892AA]">
              <HardDrive size={16} /> <span className="text-sm font-medium">Vector Storage</span>
            </div>
            <span className="text-xs font-mono text-[#F1F3F9]">{formatBytes(storageUsed)} / {formatBytes(currentPlanObj.storage)}</span>
          </div>
          <ProgressBar value={storagePct} size="sm" variant={storagePct > 80 ? 'error' : storagePct > 50 ? 'warning' : 'default'} />
          <p className="text-[10px] text-[#4A5168] mt-3 uppercase tracking-wider">{storagePct}% utilized</p>
        </div>
        <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2 text-[#8892AA]">
              <MessageSquare size={16} /> <span className="text-sm font-medium">Monthly AI Queries</span>
            </div>
            <span className="text-xs font-mono text-[#F1F3F9]">{queries} / {currentPlanObj.queries}</span>
          </div>
          <ProgressBar value={queriesPct} size="sm" variant={queriesPct > 80 ? 'error' : queriesPct > 50 ? 'warning' : 'default'} />
          <p className="text-[10px] text-[#4A5168] mt-3 uppercase tracking-wider">{queriesPct}% utilized</p>
        </div>
        <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2 text-[#8892AA]">
              <FileText size={16} /> <span className="text-sm font-medium">Indexed Documents</span>
            </div>
            <span className="text-xs font-mono text-[#F1F3F9]">{docs}</span>
          </div>
          <ProgressBar value={10} size="sm" variant="default" />
          <p className="text-[10px] text-[#4A5168] mt-3 uppercase tracking-wider">Unlimited on {currentPlanObj.label}</p>
        </div>
      </div>

      <h2 className="text-lg font-bold text-[#F1F3F9] mb-4">Available Plans</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
        {PLANS.map((plan) => {
          const isCurrent = plan.name === activeWorkspace.plan;
          return (
            <div key={plan.name} className={`bg-[#0F1117] border rounded-2xl p-8 flex flex-col ${isCurrent ? 'border-purple-500/50 shadow-[0_0_30px_rgba(168,85,247,0.1)]' : 'border-white/[0.06]'}`}>
              <h3 className="text-lg font-bold text-[#F1F3F9]">{plan.label}</h3>
              <p className="text-2xl font-bold text-[#F1F3F9] mt-2 mb-6">{plan.price} <span className="text-sm font-normal text-[#8892AA]">/ mo</span></p>
              <div className="flex-1 flex flex-col gap-4 text-sm text-[#8892AA]">
                <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-400" /> Up to {formatBytes(plan.storage)} storage</div>
                <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-400" /> {plan.queries.toLocaleString()} AI queries / mo</div>
                <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-400" /> {plan.seats} team {plan.seats === 1 ? 'member' : 'members'}</div>
              </div>
              <div className="mt-8 pt-6 border-t border-white/[0.06]">
                {isCurrent ? (
                  <button disabled className="w-full py-2.5 rounded-xl text-sm font-semibold bg-white/[0.04] text-[#8892AA] cursor-default border border-white/[0.08]">
                    Current Plan
                  </button>
                ) : (
                  <button onClick={() => setUpgradeModalOpen(true)} className="w-full py-2.5 rounded-xl text-sm font-semibold bg-white/[0.04] text-[#F1F3F9] hover:bg-white/[0.08] transition-colors border border-white/[0.08]">
                    Upgrade to {plan.label}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-6 flex flex-col min-h-[300px]">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-sm font-semibold text-[#F1F3F9] flex items-center gap-2">
              <Receipt size={16} className="text-purple-400" /> Billing History
            </h2>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-center mb-4">
              <Receipt size={20} className="text-[#4A5168]" />
            </div>
            <h3 className="text-base font-bold text-[#F1F3F9] mb-2">No Invoices Yet</h3>
            <p className="text-xs text-[#8892AA] max-w-[250px]">
              Your billing history and downloadable PDFs will appear here once you upgrade.
            </p>
          </div>
        </div>

        <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-6 flex flex-col min-h-[300px]">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-sm font-semibold text-[#F1F3F9] flex items-center gap-2">
              <CreditCard size={16} className="text-purple-400" /> Payment Methods
            </h2>
            <button className="text-xs font-medium text-purple-400 flex items-center gap-1 hover:text-purple-300">
              <Plus size={14} /> Add Card
            </button>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-center mb-4">
              <ShieldCheck size={20} className="text-[#4A5168]" />
            </div>
            <h3 className="text-base font-bold text-[#F1F3F9] mb-2">Secure Payments</h3>
            <p className="text-xs text-[#8892AA] max-w-[250px]">
              We use Stripe to securely process and store your payment details. Add a card to begin.
            </p>
          </div>
        </div>
      </div>

      <UpgradeModal open={upgradeModalOpen} onClose={() => setUpgradeModalOpen(false)} currentPlan={activeWorkspace.plan} />
    </div>
  );
}
