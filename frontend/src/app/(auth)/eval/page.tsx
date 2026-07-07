'use client';

import { lazy, Suspense, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart2, Shield, BookOpen, TrendingUp,
  Target, Brain, MessageSquare,
} from 'lucide-react';
import { PremiumBackground } from '@/components/landing/PremiumBackground';
import Link from 'next/link';
import { LoadingGrid } from './tabs/_shared';

const OverviewTab     = lazy(() => import('./tabs/OverviewTab').then(m => ({ default: m.OverviewTab })));
const TrendsTab       = lazy(() => import('./tabs/TrendsTab').then(m => ({ default: m.TrendsTab })));
const BenchmarksTab   = lazy(() => import('./tabs/BenchmarksTab').then(m => ({ default: m.BenchmarksTab })));
const LeaderboardTab  = lazy(() => import('./tabs/LeaderboardTab').then(m => ({ default: m.LeaderboardTab })));
const CitationsTab    = lazy(() => import('./tabs/CitationsTab').then(m => ({ default: m.CitationsTab })));
const TrustTab        = lazy(() => import('./tabs/TrustTab').then(m => ({ default: m.TrustTab })));
const ConversationsTab = lazy(() => import('./tabs/ConversationsTab').then(m => ({ default: m.ConversationsTab })));

const TABS = [
  { id: 'overview',       label: 'Overview',           icon: BarChart2 },
  { id: 'trends',         label: 'Quality Trends',     icon: TrendingUp },
  { id: 'benchmarks',     label: 'Benchmark Runs',     icon: Target },
  { id: 'leaderboard',    label: 'Model Leaderboard',  icon: Brain },
  { id: 'citations',      label: 'Citations',          icon: BookOpen },
  { id: 'trust',          label: 'Trust & Verdicts',   icon: Shield },
  { id: 'conversations',  label: 'Conversation Evals', icon: MessageSquare },
];

function renderTab(id: string) {
  switch (id) {
    case 'overview':      return <OverviewTab />;
    case 'trends':        return <TrendsTab />;
    case 'benchmarks':    return <BenchmarksTab />;
    case 'leaderboard':   return <LeaderboardTab />;
    case 'citations':     return <CitationsTab />;
    case 'trust':         return <TrustTab />;
    case 'conversations': return <ConversationsTab />;
    default:              return <OverviewTab />;
  }
}

export default function EvalDashboard() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="relative min-h-screen bg-[#05070B] selection:bg-purple-500/30 selection:text-white pb-32">
      <PremiumBackground glowOpacity={0.08} />

      <div className="relative z-10 mx-auto max-w-[1400px] px-6 pt-10 pb-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#F1F3F9] tracking-tight flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <BarChart2 size={20} className="text-purple-400" />
              </div>
              AI Quality Dashboard
            </h1>
            <p className="text-sm text-[#8892AA] mt-1.5">LLM evaluation · Trust verification · Benchmark management · Citation analytics</p>
          </div>
          <Link href="/eval/benchmarks" className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-500 text-white text-sm font-semibold hover:bg-purple-600 transition-colors">
            <Target size={16} />
            Benchmarks
          </Link>
        </div>

        <div className="flex gap-1 bg-[#0F1117] border border-white/[0.06] rounded-2xl p-1 mb-8 overflow-x-auto">
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    : 'text-[#8892AA] hover:text-[#F1F3F9] hover:bg-white/[0.04]'
                }`}
              >
                <tab.icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="popLayout">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
          >
            <Suspense fallback={<LoadingGrid cols={4} rows={2} />}>
              {renderTab(activeTab)}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
