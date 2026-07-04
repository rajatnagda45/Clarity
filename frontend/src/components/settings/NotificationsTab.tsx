'use client';

import { useState } from 'react';
import { Bell, Mail, Shield, Users, Cpu, FileText, BarChart2 } from 'lucide-react';

function useLocalSetting<T>(key: string, defaultValue: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue;
    const stored = localStorage.getItem(`clarity_notif_${key}`);
    if (stored == null) return defaultValue;
    try { return JSON.parse(stored) as T; } catch { return defaultValue; }
  });

  const update = (v: T) => {
    setValue(v);
    localStorage.setItem(`clarity_notif_${key}`, JSON.stringify(v));
  };

  return [value, update];
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${checked ? 'bg-purple-500' : 'bg-white/[0.1]'}`}
    >
      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

interface NotifRow {
  key: string;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

const EMAIL_NOTIFICATIONS: NotifRow[] = [
  { key: 'email_product_updates', label: 'Product Updates', description: 'New features, improvements, and release notes', icon: BarChart2, color: 'text-blue-400' },
  { key: 'email_security_alerts', label: 'Security Alerts', description: 'Suspicious login attempts and security events', icon: Shield, color: 'text-red-400' },
  { key: 'email_workspace_invites', label: 'Workspace Invites', description: 'When someone invites you to a workspace', icon: Users, color: 'text-emerald-400' },
  { key: 'email_ai_completion', label: 'AI Processing Complete', description: 'When long-running AI tasks finish', icon: Cpu, color: 'text-purple-400' },
  { key: 'email_document_indexed', label: 'Document Indexed', description: 'When uploaded documents finish indexing', icon: FileText, color: 'text-amber-400' },
];

const IN_APP_NOTIFICATIONS: NotifRow[] = [
  { key: 'app_workspace_activity', label: 'Workspace Activity', description: 'Member joins, role changes, and workspace events', icon: Users, color: 'text-blue-400' },
  { key: 'app_document_status', label: 'Document Status Changes', description: 'Real-time updates on document processing', icon: FileText, color: 'text-purple-400' },
  { key: 'app_ai_mentions', label: 'AI Completion Alerts', description: 'In-app alerts when AI tasks complete', icon: Cpu, color: 'text-emerald-400' },
  { key: 'app_security', label: 'Security Notifications', description: 'In-app security alerts and warnings', icon: Shield, color: 'text-red-400' },
];

export function NotificationsTab() {
  const settings: Record<string, [boolean, (v: boolean) => void]> = {};

  [...EMAIL_NOTIFICATIONS, ...IN_APP_NOTIFICATIONS].forEach(({ key }) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    settings[key] = useLocalSetting<boolean>(key, key.includes('security') || key.includes('invites'));
  });

  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col animate-in fade-in duration-500 max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#F1F3F9] tracking-tight flex items-center gap-2">
            <Bell size={22} className="text-purple-400" />
            Notifications
          </h1>
          <p className="text-sm text-[#8892AA] mt-1">Control how and when Clarity notifies you.</p>
        </div>
        <button
          onClick={handleSave}
          className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            saved
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-purple-500 text-white hover:bg-purple-600'
          }`}
        >
          {saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      <div className="space-y-6">
        {/* Email */}
        <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <Mail size={18} className="text-blue-400" />
            <h2 className="text-sm font-bold text-[#F1F3F9]">Email Notifications</h2>
          </div>
          <div className="space-y-5">
            {EMAIL_NOTIFICATIONS.map(({ key, label, description, icon: Icon, color }) => {
              const [checked, onChange] = settings[key];
              return (
                <div key={key} className="flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <Icon size={16} className={`${color} shrink-0 mt-0.5`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#F1F3F9]">{label}</p>
                      <p className="text-xs text-[#8892AA] mt-0.5">{description}</p>
                    </div>
                  </div>
                  <Toggle checked={checked} onChange={onChange} />
                </div>
              );
            })}
          </div>
        </div>

        {/* In-App */}
        <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <Bell size={18} className="text-purple-400" />
            <h2 className="text-sm font-bold text-[#F1F3F9]">In-App Notifications</h2>
          </div>
          <div className="space-y-5">
            {IN_APP_NOTIFICATIONS.map(({ key, label, description, icon: Icon, color }) => {
              const [checked, onChange] = settings[key];
              return (
                <div key={key} className="flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <Icon size={16} className={`${color} shrink-0 mt-0.5`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#F1F3F9]">{label}</p>
                      <p className="text-xs text-[#8892AA] mt-0.5">{description}</p>
                    </div>
                  </div>
                  <Toggle checked={checked} onChange={onChange} />
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-xs text-[#4A5168] text-center">
          Preferences are stored locally. Email delivery requires workspace billing configuration.
        </p>
      </div>
    </div>
  );
}
