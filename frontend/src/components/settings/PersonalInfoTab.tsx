'use client';

import { useUser } from '@clerk/nextjs';
import { Camera, Save, Globe, MapPin, Building2, Briefcase, Clock, Phone } from 'lucide-react';
import { useState } from 'react';

export function PersonalInfoTab() {
  const { user } = useUser();
  const [isSaving, setIsSaving] = useState(false);

  if (!user) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    // Simulate save
    setTimeout(() => setIsSaving(false), 1000);
  };

  return (
    <div className="flex flex-col animate-in fade-in duration-500 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight">Personal Information</h1>
        <p className="text-sm text-[#8892AA] mt-1">Manage your identity, contact details, and public profile.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* Photo & Cover */}
        <div className="p-6 rounded-2xl bg-[#0F1117] border border-white/[0.08]">
          <h2 className="text-sm font-semibold text-white mb-6 uppercase tracking-wider">Profile Media</h2>
          
          <div className="flex flex-col md:flex-row gap-8 items-start">
            <div className="flex flex-col items-center gap-4">
              <div className="relative group cursor-pointer">
                <img 
                  src={user.imageUrl} 
                  alt={user.fullName || 'User'} 
                  className="w-24 h-24 rounded-2xl border border-white/[0.08] object-cover"
                />
                <div className="absolute inset-0 bg-black/60 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera size={20} className="text-white" />
                </div>
              </div>
              <button type="button" className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors">
                Change Avatar
              </button>
            </div>
            
            <div className="flex-1 w-full">
              <div className="h-24 w-full rounded-2xl bg-gradient-to-r from-slate-800 to-slate-900 border border-white/[0.08] relative group overflow-hidden cursor-pointer flex flex-col items-center justify-center">
                <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay"></div>
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center justify-center">
                  <Camera size={20} className="text-white" />
                </div>
                <span className="text-xs font-medium text-[#8892AA] relative z-0">Upload Cover Image</span>
              </div>
            </div>
          </div>
        </div>

        {/* Basic Details */}
        <div className="p-6 rounded-2xl bg-[#0F1117] border border-white/[0.08]">
          <h2 className="text-sm font-semibold text-white mb-6 uppercase tracking-wider">Basic Details</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-[#8892AA]">Full Name</label>
              <input 
                type="text" 
                defaultValue={user.fullName || ''}
                className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:bg-blue-500/5 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-[#8892AA]">Display Name</label>
              <input 
                type="text" 
                defaultValue={user.username || user.firstName || ''}
                className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:bg-blue-500/5 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="text-xs font-medium text-[#8892AA]">Email Address</label>
              <input 
                type="email" 
                disabled
                defaultValue={user.primaryEmailAddress?.emailAddress || ''}
                className="bg-white/[0.02] border border-white/[0.04] rounded-xl px-4 py-2.5 text-sm text-[#8892AA] cursor-not-allowed"
              />
              <p className="text-[10px] text-[#4A5168] mt-1">Email can be changed in Security settings.</p>
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-[#8892AA] flex items-center gap-1.5"><Phone size={12}/> Phone</label>
              <input 
                type="text" 
                placeholder="+1 (555) 000-0000"
                className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:bg-blue-500/5 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-[#8892AA] flex items-center gap-1.5"><Clock size={12}/> Timezone</label>
              <select className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:bg-blue-500/5 transition-colors appearance-none">
                <option value="America/Los_Angeles">Pacific Time (PT)</option>
                <option value="America/New_York">Eastern Time (ET)</option>
                <option value="Europe/London">Greenwich Mean Time (GMT)</option>
                <option value="Asia/Tokyo">Japan Standard Time (JST)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Professional Details */}
        <div className="p-6 rounded-2xl bg-[#0F1117] border border-white/[0.08]">
          <h2 className="text-sm font-semibold text-white mb-6 uppercase tracking-wider">Professional Profile</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="text-xs font-medium text-[#8892AA]">Biography</label>
              <textarea 
                rows={4}
                placeholder="Brief description for your profile..."
                className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:bg-blue-500/5 transition-colors resize-none"
              />
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-[#8892AA] flex items-center gap-1.5"><Briefcase size={12}/> Job Title</label>
              <input 
                type="text" 
                placeholder="Software Engineer"
                className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:bg-blue-500/5 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-[#8892AA] flex items-center gap-1.5"><Building2 size={12}/> Company</label>
              <input 
                type="text" 
                placeholder="Acme Corp"
                className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:bg-blue-500/5 transition-colors"
              />
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-[#8892AA] flex items-center gap-1.5"><MapPin size={12}/> Country</label>
              <input 
                type="text" 
                placeholder="United States"
                className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:bg-blue-500/5 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-[#8892AA] flex items-center gap-1.5"><Globe size={12}/> Language</label>
              <select className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:bg-blue-500/5 transition-colors appearance-none">
                <option value="en">English (US)</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
              </select>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex justify-end pt-4 border-t border-white/[0.04]">
          <button 
            type="submit"
            disabled={isSaving}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2.5 rounded-xl font-medium text-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <Save size={16} />
            )}
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}
