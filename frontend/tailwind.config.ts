import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['11px', { lineHeight: '16px', letterSpacing: '0.01em' }],
        xs: ['12px', { lineHeight: '16px', letterSpacing: '0.01em' }],
        sm: ['13px', { lineHeight: '20px' }],
        base: ['14px', { lineHeight: '22px' }],
        md: ['15px', { lineHeight: '24px', letterSpacing: '-0.01em' }],
        lg: ['17px', { lineHeight: '26px', letterSpacing: '-0.02em' }],
        xl: ['20px', { lineHeight: '28px', letterSpacing: '-0.02em' }],
        '2xl': ['24px', { lineHeight: '32px', letterSpacing: '-0.03em' }],
        '3xl': ['30px', { lineHeight: '36px', letterSpacing: '-0.04em' }],
        '4xl': ['36px', { lineHeight: '40px', letterSpacing: '-0.04em' }],
      },
      colors: {
        surface: {
          base: 'var(--color-bg-base)',
          DEFAULT: 'var(--color-bg-surface)',
          elevated: 'var(--color-bg-elevated)',
          hover: 'var(--color-bg-hover)',
        },
        'border-subtle': 'var(--color-border-subtle)',
        'border-default': 'var(--color-border-default)',
        'border-strong': 'var(--color-border-strong)',
        fg: {
          DEFAULT: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          tertiary: 'var(--color-text-tertiary)',
          disabled: 'var(--color-text-disabled)',
          link: 'var(--color-text-link)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          hover: 'var(--color-accent-hover)',
          subtle: 'var(--color-accent-subtle)',
          fg: 'var(--color-accent-fg)',
        },
        success: {
          DEFAULT: 'var(--color-success)',
          subtle: 'var(--color-success-subtle)',
          fg: 'var(--color-success-fg)',
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          subtle: 'var(--color-warning-subtle)',
          fg: 'var(--color-warning-fg)',
        },
        danger: {
          DEFAULT: 'var(--color-error)',
          subtle: 'var(--color-error-subtle)',
          fg: 'var(--color-error-fg)',
        },
        trust: {
          high: 'var(--color-trust-high)',
          medium: 'var(--color-trust-medium)',
          low: 'var(--color-trust-low)',
          unknown: 'var(--color-trust-unknown)',
        },
      },
      borderRadius: {
        none: '0',
        xs: '2px',
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '10px',
        xl: '12px',
        '2xl': '16px',
        '3xl': '20px',
        full: '9999px',
      },
      boxShadow: {
        xs: '0 1px 2px rgba(0,0,0,0.04)',
        sm: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        DEFAULT: '0 2px 6px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)',
        md: '0 4px 10px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)',
        lg: '0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.04)',
        xl: '0 20px 40px rgba(0,0,0,0.14), 0 4px 10px rgba(0,0,0,0.06)',
        none: 'none',
      },
      transitionDuration: {
        fast: '100ms',
        normal: '160ms',
        slow: '240ms',
        slower: '400ms',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-down': {
          from: { opacity: '0', transform: 'translateY(-6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'toast-in': {
          from: { opacity: '0', transform: 'translateX(calc(100% + 16px))' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'toast-out': {
          from: { opacity: '1', transform: 'translateX(0)' },
          to: { opacity: '0', transform: 'translateX(calc(100% + 16px))' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.6s linear infinite',
        'fade-in': 'fade-in 160ms ease-out',
        'slide-up': 'slide-up 160ms cubic-bezier(0.16,1,0.3,1)',
        'slide-down': 'slide-down 160ms cubic-bezier(0.16,1,0.3,1)',
        'toast-in': 'toast-in 240ms cubic-bezier(0.16,1,0.3,1)',
        'toast-out': 'toast-out 200ms ease-in forwards',
      },
      spacing: {
        sidebar: '220px',
        topbar: '48px',
      },
    },
  },
  plugins: [],
};

export default config;
