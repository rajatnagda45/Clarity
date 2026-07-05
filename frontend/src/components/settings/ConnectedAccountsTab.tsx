'use client';

import { useUser } from '@clerk/nextjs';
import { ExternalLink, CheckCircle2, Link2, Link2Off, Loader2 } from 'lucide-react';
import { useState } from 'react';

type Provider = 'oauth_github' | 'oauth_google' | 'oauth_microsoft' | 'oauth_apple';

interface Integration {
  id: string;
  provider: Provider;
  name: string;
  icon: string;
  description: string;
}

const INTEGRATIONS: Integration[] = [
  {
    id: 'github',
    provider: 'oauth_github',
    name: 'GitHub',
    icon: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png',
    description: 'Connect your repositories for automated AI documentation.'
  },
  {
    id: 'google',
    provider: 'oauth_google',
    name: 'Google',
    icon: 'https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png',
    description: 'Sync your Google Drive documents and sign in with Google.'
  },
  {
    id: 'microsoft',
    provider: 'oauth_microsoft',
    name: 'Microsoft',
    icon: 'https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg',
    description: 'Connect OneDrive and sign in with your Microsoft account.'
  },
  {
    id: 'apple',
    provider: 'oauth_apple',
    name: 'Apple',
    icon: 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg',
    description: 'Sign in securely with your Apple ID.'
  }
];

export function ConnectedAccountsTab() {
  const { user } = useUser();
  const [connecting, setConnecting] = useState<string | null>(null);

  if (!user) return null;

  // Map Clerk's external accounts to our integration list
  const connectedProviders = user.externalAccounts.map(acc => acc.provider as string);

  const handleConnect = (id: string) => {
    setConnecting(id);
    // In a real app, we would redirect to Clerk's OAuth flow or our backend OAuth flow
    setTimeout(() => setConnecting(null), 1500);
  };

  return (
    <div className="flex flex-col animate-in fade-in duration-500 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight">Connected Accounts</h1>
        <p className="text-sm text-[#8892AA] mt-1">Connect external services to sign in and sync your data with Clarity.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {INTEGRATIONS.map((integration) => {
          const isConnected = connectedProviders.includes(integration.provider);
          const isProcessing = connecting === integration.id;
          
          return (
            <div 
              key={integration.id} 
              className={`p-6 rounded-2xl border transition-all duration-300 ${
                isConnected 
                  ? 'bg-blue-500/[0.02] border-blue-500/20' 
                  : 'bg-[#0F1117] border-white/[0.08] hover:border-white/20'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-white p-2.5 flex items-center justify-center shadow-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={integration.icon} alt={integration.name} className="w-full h-full object-contain" />
                </div>
                
                {isConnected ? (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold">
                    <CheckCircle2 size={14} /> Connected
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full bg-white/[0.04] text-[#8892AA] text-xs font-medium">
                    Not Connected
                  </span>
                )}
              </div>
              
              <h3 className="text-lg font-bold text-white mb-2">{integration.name}</h3>
              <p className="text-sm text-[#8892AA] mb-6 h-10">{integration.description}</p>
              
              <div className="flex items-center justify-between pt-6 border-t border-white/[0.04]">
                {isConnected ? (
                  <>
                    <p className="text-xs text-[#4A5168]">Last synced just now</p>
                    <button className="text-xs font-medium text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-1.5">
                      <Link2Off size={14} /> Disconnect
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-[#4A5168]">Enhances your workflow</p>
                    <button 
                      onClick={() => handleConnect(integration.id)}
                      disabled={isProcessing}
                      className="px-4 py-2 bg-white text-black hover:bg-slate-200 disabled:opacity-50 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
                    >
                      {isProcessing ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Link2 size={16} />
                      )}
                      Connect
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
