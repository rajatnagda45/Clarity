'use client';

/**
 * useGlobalShortcuts — global keyboard shortcuts for the agents workspace.
 *
 *   ⌘N / Ctrl+N  →  New agent
 *   ⌘⇧R          →  Toggle command palette
 *   ⌘K           →  Toggle command palette (alias)
 *   ⌘/           →  Focus the search bar
 *   ⌘.           →  Open the workspace switcher
 *   Esc          →  Close any open modal / drawer
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCommand } from '@/contexts/CommandContext';

export function useGlobalShortcuts() {
  const router = useRouter();
  const command = useCommand();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
      const cmd = isMac ? e.metaKey : e.ctrlKey;

      // ⌘N / Ctrl+N → New agent
      if (cmd && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'n') {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
        e.preventDefault();
        router.push('/agents/new');
        return;
      }

      // ⌘K / ⌘⇧K → Toggle command palette
      if (cmd && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (typeof command?.toggle === 'function') {
          command.toggle();
        }
        return;
      }

      // ⌘/ → Focus search bar
      if (cmd && e.key === '/') {
        const searchInput = document.querySelector<HTMLInputElement>('input[type="text"][placeholder*="Search"]');
        if (searchInput) {
          e.preventDefault();
          searchInput.focus();
        }
        return;
      }

      // ⌘. → Open workspace switcher
      if (cmd && e.key === '.') {
        e.preventDefault();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('clarity:open-workspace-switcher'));
        }
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [router, command]);
}
