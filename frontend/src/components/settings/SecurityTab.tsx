'use client';

import { useSessionList, useUser } from '@clerk/nextjs';
import { 
  ShieldCheck, Key, Smartphone, Laptop, History, 
  AlertTriangle, Shield, CheckCircle2, ChevronRight,
  Fingerprint
} from 'lucide-react';

export function SecurityTab() {
  const { user } = useUser();
  const { isLoaded, sessions } = useSessionList();

  if (!user || !isLoaded) return null;

  const securityScore = user.twoFactorEnabled ? 100 : 65;

  return (
    <div className="flex flex-col animate-in fade-in duration-500 max-w-4xl">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Security & Sessions</h1>
          <p className="text-sm text-[#8892AA] mt-1">Manage your account security, 2FA, and active sessions.</p>
        </div>
        
        {/* Security Score */}
        <div className="flex items-center gap-4 bg-[#0F1117] border border-white/[0.08] px-4 py-3 rounded-xl">
          <div className="relative flex items-center justify-center w-12 h-12">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="24" cy="24" r="20" fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
              <circle 
                cx="24" cy="24" r="20" fill="transparent" 
                stroke={securityScore === 100 ? '#10b981' : '#f59e0b'} 
                strokeWidth="4" 
                strokeDasharray={`${(securityScore / 100) * 125} 125`}
                className="transition-all duration-1000"
              />
            </svg>
            <span className={`absolute text-sm font-bold ${securityScore === 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {securityScore}
            </span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Security Score</h3>
            <p className="text-xs text-[#8892AA]">{securityScore === 100 ? 'Excellent' : 'Action Recommended'}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Left Column: Authentication */}
        <div className="md:col-span-2 space-y-8">
          
          {/* Authentication Methods */}
          <div className="rounded-2xl bg-[#0F1117] border border-white/[0.08] overflow-hidden">
            <div className="p-6 border-b border-white/[0.04]">
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                <Shield size={16} className="text-blue-400" />
                Authentication
              </h2>
            </div>
            
            <div className="divide-y divide-white/[0.04]">
              <div className="p-6 flex items-center justify-between hover:bg-white/[0.02] transition-colors group cursor-pointer">
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                    <Key size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Password</h3>
                    <p className="text-xs text-[#8892AA] mt-1">Last changed 3 months ago</p>
                  </div>
                </div>
                <button className="text-sm font-medium text-white bg-white/[0.04] border border-white/[0.08] px-4 py-2 rounded-xl group-hover:bg-white/[0.08] transition-colors">
                  Change
                </button>
              </div>

              <div className="p-6 flex items-center justify-between hover:bg-white/[0.02] transition-colors group cursor-pointer">
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-lg ${user.twoFactorEnabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                    <Smartphone size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      Two-Factor Authentication
                      {user.twoFactorEnabled ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">ENABLED</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">RECOMMENDED</span>
                      )}
                    </h3>
                    <p className="text-xs text-[#8892AA] mt-1">Protect your account with an extra layer of security.</p>
                  </div>
                </div>
                <button className="text-sm font-medium text-white bg-white/[0.04] border border-white/[0.08] px-4 py-2 rounded-xl group-hover:bg-white/[0.08] transition-colors">
                  {user.twoFactorEnabled ? 'Manage' : 'Enable'}
                </button>
              </div>

              <div className="p-6 flex items-center justify-between hover:bg-white/[0.02] transition-colors group cursor-pointer opacity-70">
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                    <Fingerprint size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      Passkeys
                      <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/60 text-[10px] font-bold">COMING SOON</span>
                    </h3>
                    <p className="text-xs text-[#8892AA] mt-1">Sign in safely with your device&apos;s biometrics.</p>
                  </div>
                </div>
                <button disabled className="text-sm font-medium text-white/50 bg-white/[0.02] border border-white/[0.04] px-4 py-2 rounded-xl cursor-not-allowed">
                  Setup
                </button>
              </div>
            </div>
          </div>

          {/* Active Sessions */}
          <div className="rounded-2xl bg-[#0F1117] border border-white/[0.08] overflow-hidden">
            <div className="p-6 border-b border-white/[0.04] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                <Laptop size={16} className="text-emerald-400" />
                Active Sessions
              </h2>
              <button className="text-xs font-medium text-rose-400 hover:text-rose-300 transition-colors">
                Sign out all other sessions
              </button>
            </div>
            
            <div className="divide-y divide-white/[0.04]">
              {sessions.map(session => (
                <div key={session.id} className="p-6 flex items-center justify-between">
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-white/[0.04] text-white">
                      {((session as any).latestActivity?.isMobile) ? <Smartphone size={20} /> : <Laptop size={20} />}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        {((session as any).latestActivity?.deviceType) || 'Unknown Device'} • {((session as any).latestActivity?.browserName) || 'Unknown Browser'}
                        {session.status === 'active' && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold">THIS DEVICE</span>
                        )}
                      </h3>
                      <p className="text-xs text-[#8892AA] mt-1">
                        {((session as any).latestActivity?.city) ? `${((session as any).latestActivity.city)}, ` : ''}{((session as any).latestActivity?.country) || 'Unknown Location'} • 
                        Last active {new Date(session.lastActiveAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {session.status !== 'active' && (
                    <button className="p-2 text-[#8892AA] hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors">
                      Revoke
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: History & Tips */}
        <div className="space-y-8">
          
          <div className="rounded-2xl bg-[#0F1117] border border-white/[0.08] overflow-hidden">
            <div className="p-6 border-b border-white/[0.04]">
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                <History size={16} className="text-purple-400" />
                Recent Logins
              </h2>
            </div>
            
            <div className="p-6">
              <div className="relative border-l border-white/[0.08] ml-3 space-y-6">
                
                {/* Timeline Item */}
                <div className="relative pl-6">
                  <div className="absolute -left-[5px] top-1 w-[9px] h-[9px] rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]"></div>
                  <h4 className="text-sm font-semibold text-white">Successful Login</h4>
                  <p className="text-xs text-[#8892AA] mt-1">Mac OS • Chrome</p>
                  <p className="text-[10px] text-[#4A5168] mt-1">Today at 10:23 AM</p>
                </div>
                
                <div className="relative pl-6">
                  <div className="absolute -left-[5px] top-1 w-[9px] h-[9px] rounded-full bg-emerald-400"></div>
                  <h4 className="text-sm font-semibold text-white">Successful Login</h4>
                  <p className="text-xs text-[#8892AA] mt-1">iOS • Safari</p>
                  <p className="text-[10px] text-[#4A5168] mt-1">Yesterday at 8:15 PM</p>
                </div>

                <div className="relative pl-6">
                  <div className="absolute -left-[5px] top-1 w-[9px] h-[9px] rounded-full bg-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.5)]"></div>
                  <h4 className="text-sm font-semibold text-rose-400">Failed Login Attempt</h4>
                  <p className="text-xs text-[#8892AA] mt-1">Unknown Device • Unknown Location</p>
                  <p className="text-[10px] text-[#4A5168] mt-1">Oct 12 at 3:42 AM</p>
                </div>

              </div>
              
              <button className="w-full mt-6 py-2 bg-white/[0.02] hover:bg-white/[0.04] text-[#8892AA] text-xs font-medium rounded-xl transition-colors">
                View Full History
              </button>
            </div>
          </div>

          {/* Security Recommendations */}
          <div className="rounded-2xl bg-gradient-to-b from-blue-500/10 to-transparent border border-blue-500/20 p-6">
            <h2 className="text-sm font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-2 mb-4">
              <ShieldCheck size={16} />
              Recommendations
            </h2>
            
            {!user.twoFactorEnabled ? (
              <div className="flex gap-3 text-sm text-[#F1F3F9]">
                <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <p>Enable Two-Factor Authentication to secure your account against unauthorized access.</p>
              </div>
            ) : (
              <div className="flex gap-3 text-sm text-[#F1F3F9]">
                <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                <p>Your account is highly secure. Consider setting up Passkeys for faster sign-ins.</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
