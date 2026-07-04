'use client';

import { useState } from 'react';
import { Settings2, Globe, Clock, Calendar, Home, Cpu } from 'lucide-react';

function useLocalSetting<T>(key: string, defaultValue: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue;
    const stored = localStorage.getItem(`clarity_prefs_${key}`);
    if (stored == null) return defaultValue;
    try { return JSON.parse(stored) as T; } catch { return defaultValue; }
  });

  const update = (v: T) => {
    setValue(v);
    localStorage.setItem(`clarity_prefs_${key}`, JSON.stringify(v));
  };

  return [value, update];
}

const LANGUAGES = [
  { value: 'en', label: 'English (US)' },
  { value: 'en-gb', label: 'English (UK)' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Español' },
  { value: 'ja', label: '日本語' },
  { value: 'zh', label: '中文 (简体)' },
];

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Asia/Kolkata',
  'Australia/Sydney',
];

const DATE_FORMATS = [
  { value: 'MM/DD/YYYY', label: '12/31/2026 (US)' },
  { value: 'DD/MM/YYYY', label: '31/12/2026 (EU)' },
  { value: 'YYYY-MM-DD', label: '2026-12-31 (ISO)' },
  { value: 'MMM DD, YYYY', label: 'Dec 31, 2026' },
];

const LANDING_PAGES = [
  { value: '/dashboard', label: 'Dashboard' },
  { value: '/documents', label: 'Documents' },
  { value: '/chat', label: 'AI Chat' },
  { value: '/collections', label: 'Collections' },
];

const AI_MODELS = [
  { value: 'gpt-4o', label: 'GPT-4o (Recommended)' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Faster)' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
];

export function PreferencesTab() {
  const [language, setLanguage] = useLocalSetting<string>('language', 'en');
  const [timezone, setTimezone] = useLocalSetting<string>('timezone', 'UTC');
  const [dateFormat, setDateFormat] = useLocalSetting<string>('date_format', 'MM/DD/YYYY');
  const [landingPage, setLandingPage] = useLocalSetting<string>('landing_page', '/dashboard');
  const [aiModel, setAiModel] = useLocalSetting<string>('ai_model', 'gpt-4o');
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
            <Settings2 size={22} className="text-purple-400" />
            Preferences
          </h1>
          <p className="text-sm text-[#8892AA] mt-1">Personalize your Clarity workspace experience.</p>
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

        {/* Regional */}
        <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-6 space-y-5">
          <h2 className="text-sm font-bold text-[#F1F3F9]">Regional & Language</h2>

          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-[#8892AA] uppercase tracking-wider mb-2">
              <Globe size={14} /> Language
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full bg-[#05070B] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-[#F1F3F9] focus:outline-none focus:border-purple-500/50 transition-colors"
            >
              {LANGUAGES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-[#8892AA] uppercase tracking-wider mb-2">
              <Clock size={14} /> Timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full bg-[#05070B] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-[#F1F3F9] focus:outline-none focus:border-purple-500/50 transition-colors"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-[#8892AA] uppercase tracking-wider mb-2">
              <Calendar size={14} /> Date Format
            </label>
            <div className="grid grid-cols-2 gap-2">
              {DATE_FORMATS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setDateFormat(value)}
                  className={`px-4 py-3 rounded-xl border text-sm text-left transition-all ${
                    dateFormat === value
                      ? 'bg-purple-500/10 border-purple-500/40 text-[#F1F3F9]'
                      : 'bg-[#05070B] border-white/[0.06] text-[#8892AA] hover:border-white/[0.15]'
                  }`}
                >
                  <span className="font-mono text-xs">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-6 space-y-5">
          <h2 className="text-sm font-bold text-[#F1F3F9]">Navigation</h2>

          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-[#8892AA] uppercase tracking-wider mb-2">
              <Home size={14} /> Default Landing Page
            </label>
            <div className="grid grid-cols-2 gap-2">
              {LANDING_PAGES.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setLandingPage(value)}
                  className={`px-4 py-3 rounded-xl border text-sm text-left transition-all ${
                    landingPage === value
                      ? 'bg-purple-500/10 border-purple-500/40 text-[#F1F3F9]'
                      : 'bg-[#05070B] border-white/[0.06] text-[#8892AA] hover:border-white/[0.15]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* AI Model */}
        <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-bold text-[#F1F3F9] flex items-center gap-2">
            <Cpu size={16} className="text-purple-400" /> Default AI Model
          </h2>
          <p className="text-xs text-[#8892AA]">Select the preferred model for AI chat and analysis. Workspace admins may override this.</p>
          <div className="space-y-2">
            {AI_MODELS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setAiModel(value)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition-all ${
                  aiModel === value
                    ? 'bg-purple-500/10 border-purple-500/40 text-[#F1F3F9]'
                    : 'bg-[#05070B] border-white/[0.06] text-[#8892AA] hover:border-white/[0.15]'
                }`}
              >
                <span>{label}</span>
                {aiModel === value && <div className="w-2 h-2 rounded-full bg-purple-400" />}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-[#4A5168] text-center">Preferences are saved locally on this device.</p>
      </div>
    </div>
  );
}
