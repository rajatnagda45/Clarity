'use client';

import { useUser } from '@clerk/nextjs';
import { User, Mail, Shield, CheckCircle2 } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export function ProfileTab() {
  const { user } = useUser();
  const { activeWorkspace } = useWorkspace();

  if (!user) return null;

  return (
    <div className="flex flex-col animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#F1F3F9] tracking-tight">Your Profile</h1>
          <p className="text-sm text-[#8892AA] mt-1">Manage your personal information and preferences.</p>
        </div>
      </div>

      <div className="bg-[#0F1117] border border-white/[0.06] rounded-[24px] p-8 mb-8">
        <div className="flex items-start gap-6">
          <div className="relative">
            <img 
              src={user.imageUrl} 
              alt="Profile" 
              className="w-24 h-24 rounded-full border-4 border-[#05070B] shadow-xl"
            />
            <div className="absolute bottom-0 right-0 w-6 h-6 bg-emerald-500 border-2 border-[#0F1117] rounded-full flex items-center justify-center">
              <CheckCircle2 size={12} className="text-[#0F1117]" />
            </div>
          </div>
          <div className="flex-1 mt-2">
            <h2 className="text-2xl font-bold text-[#F1F3F9]">{user.fullName}</h2>
            <div className="flex items-center gap-4 mt-2 text-sm text-[#8892AA]">
              <span className="flex items-center gap-1.5"><Mail size={14} /> {user.primaryEmailAddress?.emailAddress}</span>
              <span>•</span>
              <span className="flex items-center gap-1.5"><Shield size={14} /> {activeWorkspace?.role || 'Member'}</span>
            </div>
          </div>
        </div>
      </div>

      <h2 className="text-lg font-bold text-[#F1F3F9] mb-4">Personal Information</h2>
      <div className="bg-[#0F1117] border border-white/[0.06] rounded-[24px] p-6 mb-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#8892AA] uppercase tracking-wider">Full Name</label>
            <input 
              type="text" 
              defaultValue={user.fullName || ''} 
              disabled
              className="w-full bg-[#05070B] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-[#8892AA] cursor-not-allowed"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#8892AA] uppercase tracking-wider">Email Address</label>
            <input 
              type="text" 
              defaultValue={user.primaryEmailAddress?.emailAddress || ''} 
              disabled
              className="w-full bg-[#05070B] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-[#8892AA] cursor-not-allowed"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#8892AA] uppercase tracking-wider">Timezone</label>
            <select disabled className="w-full bg-[#05070B] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-[#8892AA] cursor-not-allowed appearance-none">
              <option>UTC (Coordinated Universal Time)</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#8892AA] uppercase tracking-wider">Language</label>
            <select disabled className="w-full bg-[#05070B] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-[#8892AA] cursor-not-allowed appearance-none">
              <option>English (US)</option>
            </select>
          </div>
        </div>
        
        <div className="pt-4 border-t border-white/[0.06] flex justify-end gap-3">
          <button disabled className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-white/[0.04] text-[#8892AA] cursor-not-allowed border border-white/[0.08]">
            Managed by Clerk
          </button>
        </div>
      </div>
    </div>
  );
}
