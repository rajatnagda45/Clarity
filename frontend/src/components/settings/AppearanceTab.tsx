'use client';

import { useState, useEffect } from 'react';
import { Palette, Monitor, Moon, Sun, Zap, Layout, Minus, AlignJustify } from 'lucide-react';

type ThemeMode = 'dark' | 'system';
type DensityMode = 'comfortable' | 'compact' | 'spacious';

const ACCENT_COLORS = [
  { name: 'Purple', value: '#8B5CF6' },
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Cyan', value: '#06B6D4' },
  { name: 'Emerald', value: '#10B981' },
  { name: 'Rose', value: '#F43F5E' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Amber', value: '#F59E0B' },
  { name: 'Indigo', value: '#6366F1' },
];

function useLocalSetting<T>(key: string, defaultValue: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue;
    const stored = localStorage.getItem(`clarity_pref_${key}`);
    if (stored == null) return defaultValue;
    try { return JSON.parse(stored) as T; } catch { return defaultValue; }
  });

  const update = (v: T) => {
    setValue(v);
    localStorage.setItem(`clarity_pref_${key}`, JSON.stringify(v));
  };

  return [value, update];
}

export function AppearanceTab() {
  const [theme, setTheme] = useLocalSetting<ThemeMode>('theme', 'dark');
  const [accentColor, setAccentColor] = useLocalSetting<string>('accent_color', '#8B5CF6');
  const [reducedMotion, setReducedMotion] = useLocalSetting<boolean>('reduced_motion', false);
  const [density, setDensity] = useLocalSetting<DensityMode>('density', 'comfortable');
  const [sidebarCollapsed, setSidebarCollapsed] = useLocalSetting<boolean>('sidebar_default_collapsed', false);
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
            <Palette size={22} className="text-purple-400" />
            Appearance
          </h1>
          <p className="text-sm text-[#8892AA] mt-1">Customize the look and feel of your workspace.</p>
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
        {/* Theme */}
        <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-6">
          <h2 className="text-sm font-bold text-[#F1F3F9] mb-1">Theme</h2>
          <p className="text-xs text-[#8892AA] mb-4">Choose how Clarity looks on your device.</p>
          <div className="grid grid-cols-2 gap-3">
            {([
              { value: 'dark', label: 'Dark', icon: Moon, description: 'Always dark theme' },
              { value: 'system', label: 'System', icon: Monitor, description: 'Follows OS setting' },
            ] as const).map(({ value, label, icon: Icon, description }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${
                  theme === value
                    ? 'bg-purple-500/10 border-purple-500/40'
                    : 'bg-[#05070B] border-white/[0.06] hover:border-white/[0.15]'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${theme === value ? 'bg-purple-500/20 text-purple-400' : 'bg-white/[0.04] text-[#4A5168]'}`}>
                  <Icon size={16} />
                </div>
                <div>
                  <p className={`text-sm font-semibold ${theme === value ? 'text-[#F1F3F9]' : 'text-[#8892AA]'}`}>{label}</p>
                  <p className="text-xs text-[#4A5168] mt-0.5">{description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Accent Color */}
        <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-6">
          <h2 className="text-sm font-bold text-[#F1F3F9] mb-1">Accent Color</h2>
          <p className="text-xs text-[#8892AA] mb-4">Select the primary highlight color used throughout the interface.</p>
          <div className="flex flex-wrap gap-3">
            {ACCENT_COLORS.map(({ name, value }) => (
              <button
                key={value}
                onClick={() => setAccentColor(value)}
                title={name}
                className={`w-8 h-8 rounded-full transition-all ${
                  accentColor === value ? 'ring-2 ring-offset-2 ring-offset-[#0F1117] scale-110' : 'hover:scale-105'
                }`}
                style={{ backgroundColor: value, outlineColor: value }}
              />
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: accentColor }} />
            <span className="text-xs text-[#8892AA]">
              {ACCENT_COLORS.find((c) => c.value === accentColor)?.name ?? 'Custom'} — {accentColor}
            </span>
          </div>
        </div>

        {/* Density */}
        <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-6">
          <h2 className="text-sm font-bold text-[#F1F3F9] mb-1">Interface Density</h2>
          <p className="text-xs text-[#8892AA] mb-4">Control how compact or spacious the layout feels.</p>
          <div className="grid grid-cols-3 gap-3">
            {([
              { value: 'compact', label: 'Compact', icon: Minus, description: 'More content visible' },
              { value: 'comfortable', label: 'Comfortable', icon: Layout, description: 'Balanced spacing' },
              { value: 'spacious', label: 'Spacious', icon: AlignJustify, description: 'More breathing room' },
            ] as const).map(({ value, label, icon: Icon, description }) => (
              <button
                key={value}
                onClick={() => setDensity(value)}
                className={`flex flex-col items-center p-4 rounded-xl border text-center transition-all ${
                  density === value
                    ? 'bg-purple-500/10 border-purple-500/40'
                    : 'bg-[#05070B] border-white/[0.06] hover:border-white/[0.15]'
                }`}
              >
                <Icon size={20} className={density === value ? 'text-purple-400' : 'text-[#4A5168]'} />
                <p className={`text-xs font-semibold mt-2 ${density === value ? 'text-[#F1F3F9]' : 'text-[#8892AA]'}`}>{label}</p>
                <p className="text-[10px] text-[#4A5168] mt-0.5">{description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Toggles */}
        <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-6 space-y-5">
          <h2 className="text-sm font-bold text-[#F1F3F9]">Accessibility & Motion</h2>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#F1F3F9] flex items-center gap-2">
                <Zap size={16} className="text-amber-400" /> Reduce Motion
              </p>
              <p className="text-xs text-[#8892AA] mt-0.5">Disable animations and transitions</p>
            </div>
            <button
              onClick={() => setReducedMotion(!reducedMotion)}
              className={`relative w-11 h-6 rounded-full transition-colors ${reducedMotion ? 'bg-purple-500' : 'bg-white/[0.1]'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${reducedMotion ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="h-px bg-white/[0.04]" />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#F1F3F9] flex items-center gap-2">
                <Sun size={16} className="text-blue-400" /> Collapse Sidebar by Default
              </p>
              <p className="text-xs text-[#8892AA] mt-0.5">Start with the sidebar collapsed on page load</p>
            </div>
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={`relative w-11 h-6 rounded-full transition-colors ${sidebarCollapsed ? 'bg-purple-500' : 'bg-white/[0.1]'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${sidebarCollapsed ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
