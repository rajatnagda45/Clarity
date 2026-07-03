'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, Building2, Bell, Palette, ShieldCheck, Cpu, 
  Puzzle, Key, CreditCard, Activity, Settings2, Info, Search
} from 'lucide-react';
import { PremiumBackground } from '@/components/landing/PremiumBackground';
import { WorkspaceTab } from '@/components/settings/WorkspaceTab';
import { BillingTab } from '@/components/settings/BillingTab';
import { PlaceholderTab } from '@/components/settings/PlaceholderTab';
import { AccountOverviewTab } from '@/components/settings/AccountOverviewTab';
import { PersonalInfoTab } from '@/components/settings/PersonalInfoTab';
import { SecurityTab } from '@/components/settings/SecurityTab';
import { ConnectedAccountsTab } from '@/components/settings/ConnectedAccountsTab';
import { AIUsageTab } from '@/components/settings/AIUsageTab';
import { ApiKeysTab } from '@/components/settings/ApiKeysTab';
import { ActivityTab } from '@/components/settings/ActivityTab';
import { AdvancedSettingsTab } from '@/components/settings/AdvancedSettingsTab';

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

export default function SettingsHub() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const queryTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(queryTab || 'overview');

  // Update URL when tab changes, and update tab when URL changes
  useEffect(() => {
    if (queryTab && queryTab !== activeTab) {
      setActiveTab(queryTab);
    }
  }, [queryTab]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    router.push(`/settings?tab=${tabId}`);
  };

  const [search, setSearch] = useState('');

  const renderContent = () => {
    switch (activeTab) {
      case 'overview': return <AccountOverviewTab />;
      case 'personal-info': return <PersonalInfoTab />;
      case 'security': return <SecurityTab />;
      case 'connected-accounts': return <ConnectedAccountsTab />;
      case 'ai-usage': return <AIUsageTab />;
      case 'api-keys': return <ApiKeysTab />;
      case 'activity': return <ActivityTab />;
      
      case 'workspace': return <WorkspaceTab />;
      case 'billing': return <BillingTab />;
      
      // Advanced is now a real tab
      case 'advanced': return <AdvancedSettingsTab />;
      
      case 'appearance': return <PlaceholderTab title="Appearance" description="Customize themes, colors, and layout density." icon={Palette} />;
      case 'notifications': return <PlaceholderTab title="Notifications" description="Configure email and desktop alerts for your workspace." icon={Bell} />;
      case 'usage': return <PlaceholderTab title="Usage Quotas" description="Monitor detailed API, token, and storage consumption." icon={Activity} />;
      case 'security': return <PlaceholderTab title="Security" description="Configure 2FA, SSO, and audit logs." icon={ShieldCheck} />;
      case 'ai': return <PlaceholderTab title="AI Preferences" description="Configure default models, streaming options, and context windows." icon={Cpu} />;
      case 'integrations': return <PlaceholderTab title="Integrations" description="Connect third-party services and data sources." icon={Puzzle} />;
      case 'api': return <PlaceholderTab title="API Keys" description="Manage developer keys and webhooks." icon={Key} />;
      case 'about': return <PlaceholderTab title="About" description="System status, versions, and documentation." icon={Info} />;
      
      default: return <AccountOverviewTab />;
    }
  };

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
              // Simple client-side search filter
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
                        className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
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
              transition={{ duration: 0.2 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}
