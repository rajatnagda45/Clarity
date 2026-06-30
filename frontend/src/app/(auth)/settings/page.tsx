import Link from 'next/link';
import { AppShell } from '@/components/shell/AppShell';

export const metadata = { title: 'Settings — Clarity' };

export default function SettingsPage() {
  const links = [
    { href: '/settings/workspace', label: 'Workspace', description: 'Manage workspaces, members, and billing.' },
  ];

  return (
    <AppShell breadcrumbs={[{ label: 'Settings' }]}>
      <div className="mx-auto w-full max-w-2xl px-6 py-8 flex flex-col gap-8">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Settings</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Configure your Clarity account and workspaces.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="flex items-center gap-4 rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] px-5 py-4 hover:border-[var(--color-border-default)] hover:shadow-sm transition-all"
            >
              <div className="flex flex-1 flex-col">
                <span className="text-sm font-semibold text-[var(--color-text-primary)]">{l.label}</span>
                <span className="text-xs text-[var(--color-text-tertiary)]">{l.description}</span>
              </div>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" className="text-[var(--color-text-tertiary)]">
                <path d="M4.5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              </svg>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
