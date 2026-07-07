'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type Theme = 'light' | 'dark' | 'system';

interface UIContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  sidebarOpen: boolean; // Mobile open state
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  sidebarCollapsed: boolean; // Desktop collapsed state
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
}

const UIContext = createContext<UIContextValue | null>(null);

const THEME_KEY = 'clarity:theme';
const SIDEBAR_KEY = 'clarity:sidebar-open';
const COLLAPSED_KEY = 'clarity:sidebar-collapsed';

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem(THEME_KEY) as Theme | null;
  if (stored === 'dark' || stored === 'light' || stored === 'system') return stored;
  return 'system';
}

function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
}

function applyTheme(theme: Theme) {
  const resolved = resolveTheme(theme);
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.setAttribute('data-theme', 'dark');
    root.classList.add('dark');
  } else {
    root.removeAttribute('data-theme');
    root.classList.remove('dark');
  }
}

export function UIProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [sidebarOpen, setSidebarOpenState] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const t = readStoredTheme();
    setThemeState(t);
    applyTheme(t);

    const storedSidebar = localStorage.getItem(SIDEBAR_KEY);
    // Default sidebar open on desktop, closed on mobile
    const defaultOpen = window.innerWidth >= 768;
    setSidebarOpenState(storedSidebar !== null ? storedSidebar === 'true' : defaultOpen);

    const storedCollapsed = localStorage.getItem(COLLAPSED_KEY);
    if (storedCollapsed !== null) {
      setSidebarCollapsedState(storedCollapsed === 'true');
    }
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem(THEME_KEY, next);
      applyTheme(next);
      return next;
    });
  }, []);

  const setSidebarOpen = useCallback((open: boolean) => {
    setSidebarOpenState(open);
    localStorage.setItem(SIDEBAR_KEY, String(open));
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpenState((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_KEY, String(next));
      return next;
    });
  }, []);

  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    setSidebarCollapsedState(collapsed);
    localStorage.setItem(COLLAPSED_KEY, String(collapsed));
  }, []);

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsedState((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSED_KEY, String(next));
      return next;
    });
  }, []);

  const openCommandPalette = useCallback(() => setCommandPaletteOpen(true), []);
  const closeCommandPalette = useCallback(() => setCommandPaletteOpen(false), []);

  // ⌘K is handled by CommandContext to avoid double-firing.
  // UIContext only manages theme, sidebar, and palette open-state for legacy shell components.

  const value = useMemo(
    () => ({
      theme, setTheme, toggleTheme,
      sidebarOpen, setSidebarOpen, toggleSidebar,
      sidebarCollapsed, setSidebarCollapsed, toggleSidebarCollapsed,
      commandPaletteOpen, setCommandPaletteOpen, openCommandPalette, closeCommandPalette,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme, sidebarOpen, sidebarCollapsed, commandPaletteOpen],
  );

  return (
    <UIContext.Provider value={value}>
      {children}
    </UIContext.Provider>
  );
}

export function useUI(): UIContextValue {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used inside UIProvider');
  return ctx;
}
