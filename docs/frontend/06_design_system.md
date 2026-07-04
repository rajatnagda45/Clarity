# Design System

Our design system is built entirely on Tailwind CSS variables (CSS Custom Properties). This ensures that we can alter the entire aesthetic globally without chasing down hardcoded HEX values.

## Core Design Tokens (`src/app/globals.css`)

| Token | CSS Variable | Value | Purpose |
|-------|-------------|-------|---------|
| **Base BG** | `--color-bg-base` | `#05070B` | The absolute bottom layer of the app. |
| **Surface BG** | `--color-bg-surface` | `#0F1117` | The default background for Cards, sidebars, and modals. |
| **Elevated BG** | `--color-bg-elevated` | `#151923` | Hover states, active tabs, and lifted elements. |
| **Primary Text** | `--color-text-primary` | `#F1F3F9` | Headings and primary text. |
| **Muted Text** | `--color-text-muted` | `#8892AA` | Secondary text, placeholders, and descriptions. |
| **Subtle Border**| `--color-border-subtle` | `rgba(255,255,255,0.06)`| Dividers, structural borders. |

## Typography
- **Font**: Inter (Google Fonts), loaded via Next.js `next/font/google`.
- **Weights**: We strictly use Regular (400) for body, Medium (500) for UI elements, and Bold (700) for headings.

## Glassmorphism & Depth
We simulate depth through:
1. **Drop Shadows**: Glowing shadows using our brand colors (`rgba(168,85,247,0.1)` for Purple).
2. **Backdrop Blur**: Modals use `backdrop-blur-sm` with a semitransparent overlay (`bg-[#05070B]/80`) to maintain context while focusing attention.
3. **Inner Shadows**: Badges and active elements often use `shadow-inner` to simulate physical depth.

## Reusable UI Primitives (`src/components/ds/`)
We are actively building a pure design system folder.
- **`EmptyState.tsx`**: Used aggressively. Whenever a dataset is empty (e.g., no documents, no active workspace), we render this instead of a blank screen. It includes a subtle radial glow and bouncy Framer Motion entry.
- **`Progress.tsx`**: A reusable, animated progress bar.
