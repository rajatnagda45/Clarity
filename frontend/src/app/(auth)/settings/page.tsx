'use client';

import { lazy, Suspense, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Building2, Bell, Palette, ShieldCheck, Cpu,
  Puzzle, Key, CreditCard, Activity, Settings2, Info, Search,
} from 'lucide-react';
import { PremiumBackground } from '@/components/landing/PremiumBackground';

// Lazy-load every tab — only the active tab's bundle is fetched
const AccountOverviewTab = lazy(() => import('@/components/settings/AccountOverviewTab').then(m => ({ default: m.AccountOverviewTab })));
const PersonalInfoTab = lazy(() => import('@/components/settings/PersonalInfoTab').then(m => ({ default: m.PersonalInfoTab })));
const SecurityTab = lazy(() => import('@/components/settings/SecurityTab').then(m => ({ default: m.SecurityTab })));
const ConnectedAccountsTab = lazy(() => import('@/components/settings/ConnectedAccountsTab').then(m => ({ default: m.ConnectedAccountsTab })));
const AIUsageTab = lazy(() => import('@/components/settings/AIUsageTab').then(m => ({ default: m.AIUsageTab })));
const ApiKeysTab = lazy(() => import('@/components/settings/ApiKeysTab').then(m => ({ default: m.ApiKeysTab })));
const PreferencesTab = lazy(() => import('@/components/settings/PreferencesTab').then(m => ({ default: m.PreferencesTab })));
const ActivityTab = lazy(() => import('@/components/settings/ActivityTab').then(m => ({ default: m.ActivityTab })));
const WorkspaceTab = lazy(() => import('@/components/settings/WorkspaceTab').then(m => ({ default: m.WorkspaceTab })));
const BillingTab = lazy(() => import('@/components/settings/BillingTab').then(m => ({ default: m.BillingTab })));
const UsageTab = lazy(() => import('@/components/settings/UsageTab').then(m => ({ default: m.UsageTab })));
const AppearanceTab = lazy(() => import('@/components/settings/AppearanceTab').then(m => ({ default: m.AppearanceTab })));
const NotificationsTab = lazy(() => import('@/components/settings/NotificationsTab').then(m => ({ default: m.NotificationsTab })));
const AdvancedSettingsTab = lazy(() => import('@/components/settings/AdvancedSettingsTab').then(m => ({ default: m.AdvancedSettingsTab })));
const AboutTab = lazy(() => import('@/components/settings/AboutTab').then(m => ({ default: m.AboutTab })));

const NAV_GROUPS = [
  {
    title: 'Account',
    items: [
      { id: 'overview', label: 'Overview', icon: User },
      { id: 'personal-info', label: 'Personal Information', icon: User },
      { id: 'security', label: 'Security & Sessions', icon: ShieldCheck },
      { id: 'connected-accounts', label: 'Connected Accounts', icon: Puzzle },
      { id: 'ai-usage', label: 'AI Usage', icon: Cpu },
      { id: 'api-keys', label: 'API Keys', icon: Key },
      { id: 'preferences', label: 'Preferences', icon: Settings2 },
      { id: 'activity', label: 'Activity', icon: Activity },
    ]
  },
  {
    title: 'Workspace',
    items: [
      { id: 'workspace', label: 'Workspace Settings', icon: Building2 },
      { id: 'billing', label: 'Billing & Plans', icon: CreditCard },
      { id: 'usage', label: 'Workspace Usage', icon: Activity },
    ]
  },
  {
    title: 'System',
    items: [
      { id: 'appearance', label: 'Appearance', icon: Palette },
      { id: 'notifications', label: 'Notifications', icon: Bell },
      { id: 'advanced', label: 'Advanced', icon: Settings2 },
      { id: 'about', label: 'About', icon: Info },
    ]
  }
];

import { useSearchParams, useRouter } from 'next/navigation';

function TabContent({ activeTab }: { activeTab: string }) {
  switch (activeTab) {
    case 'overview': return <AccountOverviewTab />;
    case 'personal-info': return <PersonalInfoTab />;
    case 'security': return <SecurityTab />;
    case 'connected-accounts': return <ConnectedAccountsTab />;
    case 'ai-usage': return <AIUsageTab />;
    case 'api-keys': return <ApiKeysTab />;
    case 'preferences': return <PreferencesTab />;
    case 'activity': return <ActivityTab />;
    case 'workspace': return <WorkspaceTab />;
    case 'billing': return <BillingTab />;
    case 'usage': return <UsageTab />;
    case 'appearance': return <AppearanceTab />;
    case 'notifications': return <NotificationsTab />;
    case 'advanced': return <AdvancedSettingsTab />;
    case 'about': return <AboutTab />;
    default: return <AccountOverviewTab />;
  }
}

function TabSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-white/[0.04]" />
      <div className="h-px w-full bg-white/[0.06]" />
      <div className="flex flex-col gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 w-full rounded-xl bg-white/[0.03]" />
        ))}
      </div>
    </div>
  );
}

export default function SettingsHub() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const queryTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(queryTab || 'overview');

  useEffect(() => {
    if (queryTab && queryTab !== activeTab) {
      setActiveTab(queryTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryTab]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    router.push(`/settings?tab=${tabId}`);
  };

  const [search, setSearch] = useState('');

  return (
    <div className="relative min-h-screen bg-[#05070B] selection:bg-purple-500/30 selection:text-white pb-32">
      <PremiumBackground glowOpacity={0.1} />

      <div className="mx-auto flex w-full max-w-[1400px] flex-col lg:flex-row px-6 pt-12 pb-8 relative z-10 gap-12">

        {/* Left Navigation Sidebar */}
        <div className="w-full lg:w-64 shrink-0 flex flex-col gap-8">

          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A5168]" />
            <input
              type="text"
              placeholder="Search settings..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#0F1117] border border-white/[0.08] rounded-xl pl-9 pr-4 py-2.5 text-sm text-[#F1F3F9] placeholder:text-[#4A5168] focus:outline-none focus:border-purple-500/50 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-6">
            {NAV_GROUPS.map((group) => {
              const filteredItems = group.items.filter(item => item.label.toLowerCase().includes(search.toLowerCase()));
              if (filteredItems.length === 0) return null;

              return (
                <div key={group.title} className="flex flex-col gap-1">
                  <h3 className="px-3 text-[11px] font-bold uppercase tracking-wider text-[#4A5168] mb-2">{group.title}</h3>
                  {filteredItems.map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleTabChange(item.id)}
                        className={`relative flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                          isActive
                            ? 'text-[#F1F3F9] bg-white/[0.06] shadow-sm'
                            : 'text-[#8892AA] hover:text-[#F1F3F9] hover:bg-white/[0.02]'
                          }
                        `}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="activeNavBackground"
                            className="absolute inset-0 bg-white/[0.06] rounded-xl border border-white/[0.04]"
                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                          />
                        )}
                        <item.icon size={16} className={`relative z-10 ${isActive ? 'text-purple-400' : 'text-[#4A5168]'}`} />
                        <span className="relative z-10">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0 pb-32">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.15 }}
            >
              <Suspense fallback={<TabSkeleton />}>
                <TabContent activeTab={activeTab} />
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}
