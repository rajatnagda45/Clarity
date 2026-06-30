'use client';

import { useAuth, useUser } from '@clerk/nextjs';
import { cn } from '@/lib/cn';
import { Avatar } from '@/components/ds/Avatar';
import { DropdownMenu, DropdownItem, DropdownSeparator, DropdownLabel } from '@/components/ds/Dropdown';
import { useUI } from '@/contexts/UIContext';
import { ThemeSwitcher } from './ThemeSwitcher';

export function UserMenu() {
  const { user, isLoaded } = useUser();
  const { signOut } = useAuth();
  const { theme } = useUI();

  if (!isLoaded || !user) return null;

  const name = user.fullName ?? user.primaryEmailAddress?.emailAddress ?? 'User';
  const email = user.primaryEmailAddress?.emailAddress;
  const avatarUrl = user.imageUrl;

  const trigger = (
    <div
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg p-1.5',
        'transition-colors duration-fast hover:bg-[var(--color-bg-hover)]',
      )}
    >
      <Avatar src={avatarUrl} name={name} size="sm" />
      <div className="flex min-w-0 flex-1 flex-col text-left">
        <span className="truncate text-xs font-medium text-[var(--color-text-primary)]">{name}</span>
        {email && (
          <span className="truncate text-2xs text-[var(--color-text-tertiary)]">{email}</span>
        )}
      </div>
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="currentColor"
        className="shrink-0 text-[var(--color-text-tertiary)]"
        aria-hidden="true"
      >
        <path d="M3 5l3-3 3 3M3 7l3 3 3-3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </svg>
    </div>
  );

  return (
    <DropdownMenu trigger={trigger} align="end">
      <DropdownLabel>Account</DropdownLabel>
      <DropdownItem
        icon={<ProfileIcon />}
        onClick={() => window.location.assign('/settings/profile')}
      >
        Profile
      </DropdownItem>
      <DropdownItem
        icon={<SettingsIcon />}
        onClick={() => window.location.assign('/settings')}
      >
        Settings
      </DropdownItem>

      <DropdownSeparator />

      <DropdownLabel>Appearance</DropdownLabel>
      {/* Theme switcher inline */}
      <div className="px-3 py-1.5">
        <ThemeSwitcher inline />
      </div>

      <DropdownSeparator />

      <DropdownItem
        icon={<SignOutIcon />}
        destructive
        onClick={() => signOut()}
      >
        Sign out
      </DropdownItem>
    </DropdownMenu>
  );
}

function ProfileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path d="M7 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM7 8c-3.314 0-6 1.343-6 3v1h12v-1c0-1.657-2.686-3-6-3z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path d="M7 4.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zm0 1a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm5.39-1.04-.55-1.33-1.4.31A4.14 4.14 0 0 0 9.25 2.6L8.75.5h-1.5l-.5 2.1a4.14 4.14 0 0 0-1.19.84l-1.4-.31-.55 1.33 1.15.87A4.22 4.22 0 0 0 4.5 7c0 .25.02.5.06.69L3.41 8.56l.55 1.33 1.4-.31c.34.33.74.6 1.19.84l.5 2.08h1.5l.5-2.08c.45-.24.85-.51 1.19-.84l1.4.31.55-1.33L10.94 7.7c.04-.2.06-.44.06-.69 0-.25-.02-.5-.06-.69l1.15-.87z" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path d="M5 2H2v10h3v1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h3v1zm4.293 2.293L12.586 7l-3.293 3.293-1.414-1.414L9.172 7.5H5v-1h4.172L7.879 5.707l1.414-1.414z" />
    </svg>
  );
}
