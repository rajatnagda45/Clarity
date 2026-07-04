'use client';

import { useUser } from '@clerk/nextjs';
import { Camera, Save, Globe, MapPin, Building2, Briefcase, Clock, Phone, CheckCircle2, AlertCircle } from 'lucide-react';
import { useState } from 'react';

export function PersonalInfoTab() {
  const { user } = useUser();
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [username, setUsername] = useState(user?.username || '');
  const [phone, setPhone] = useState((user?.unsafeMetadata?.phone as string) || '');
  const [timezone, setTimezone] = useState((user?.unsafeMetadata?.timezone as string) || 'America/Los_Angeles');
  const [bio, setBio] = useState((user?.unsafeMetadata?.bio as string) || '');
  const [jobTitle, setJobTitle] = useState((user?.unsafeMetadata?.jobTitle as string) || '');
  const [company, setCompany] = useState((user?.unsafeMetadata?.company as string) || '');
  const [country, setCountry] = useState((user?.unsafeMetadata?.country as string) || '');
  const [language, setLanguage] = useState((user?.unsafeMetadata?.language as string) || 'en');

  if (!user) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveStatus('idle');
    setErrorMessage('');

    try {
      await user.update({
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        username: username.trim() || undefined,
        unsafeMetadata: {
          ...user.unsafeMetadata,
          phone: phone.trim(),
          timezone,
          bio: bio.trim(),
          jobTitle: jobTitle.trim(),
          company: company.trim(),
          country: country.trim(),
          language,
        },
      });
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save. Please try again.';
      setErrorMessage(message);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col animate-in fade-in duration-500 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight">Personal Information</h1>
        <p className="text-sm text-[#8892AA] mt-1">Manage your identity, contact details, and public profile.</p>
      </div>

      {saveStatus === 'success' && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-6">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <p className="text-sm text-emerald-400">Profile saved successfully.</p>
        </div>
      )}
      {saveStatus === 'error' && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 mb-6">
          <AlertCircle size={16} className="text-red-400 shrink-0" />
          <p className="text-sm text-red-400">{errorMessage}</p>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8">
        {/* Photo */}
        <div className="p-6 rounded-2xl bg-[#0F1117] border border-white/[0.08]">
          <h2 className="text-sm font-semibold text-white mb-6 uppercase tracking-wider">Profile Photo</h2>
          <div className="flex items-center gap-6">
            <div className="relative group cursor-pointer">
              <img
                src={user.imageUrl}
                alt={user.fullName || 'User'}
                className="w-20 h-20 rounded-2xl border border-white/[0.08] object-cover"
              />
              <div className="absolute inset-0 bg-black/60 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera size={18} className="text-white" />
              </div>
            </div>
            <p className="text-xs text-[#4A5168]">Photo is managed via your Clerk account. Click to update.</p>
          </div>
        </div>

        {/* Basic Details */}
        <div className="p-6 rounded-2xl bg-[#0F1117] border border-white/[0.08]">
          <h2 className="text-sm font-semibold text-white mb-6 uppercase tracking-wider">Basic Details</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-[#8892AA]">First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:bg-blue-500/5 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-[#8892AA]">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:bg-blue-500/5 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-[#8892AA]">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:bg-blue-500/5 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-2 md:col-span-1">
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
              <label className="text-xs font-medium text-[#8892AA] flex items-center gap-1.5"><Phone size={12} /> Phone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:bg-blue-500/5 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-[#8892AA] flex items-center gap-1.5"><Clock size={12} /> Timezone</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:bg-blue-500/5 transition-colors appearance-none"
              >
                <option value="America/Los_Angeles">Pacific Time (PT)</option>
                <option value="America/New_York">Eastern Time (ET)</option>
                <option value="Europe/London">Greenwich Mean Time (GMT)</option>
                <option value="Asia/Tokyo">Japan Standard Time (JST)</option>
                <option value="Asia/Kolkata">India Standard Time (IST)</option>
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
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Brief description for your profile..."
                className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:bg-blue-500/5 transition-colors resize-none"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-[#8892AA] flex items-center gap-1.5"><Briefcase size={12} /> Job Title</label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Software Engineer"
                className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:bg-blue-500/5 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-[#8892AA] flex items-center gap-1.5"><Building2 size={12} /> Company</label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Acme Corp"
                className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:bg-blue-500/5 transition-colors"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-[#8892AA] flex items-center gap-1.5"><MapPin size={12} /> Country</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="United States"
                className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:bg-blue-500/5 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-[#8892AA] flex items-center gap-1.5"><Globe size={12} /> Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:bg-blue-500/5 transition-colors appearance-none"
              >
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
