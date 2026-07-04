# Component Architecture

We strictly separate layout shells, business features, and pure UI components.

## 1. Pure UI Components (`components/ds/`)
These components accept props and emit events. They NEVER import hooks like `useWorkspace` or `useDocuments`.
- **`EmptyState.tsx`**: Accepts `icon`, `title`, `description`, and `action` (a React node). Handles its own entry animation.
- **`Dialog.tsx`**: (Pending migration to `ds/`) Should act as the base for all modals.

## 2. Layout Shells (`components/layout/`)
These components manage the application's framing and navigation.
- **`DarkAppLayout.tsx`**: The master layout. It reads `UIContext` to determine if the sidebar is open, renders `DarkSidebar`, and wraps the `{children}` (the current Next.js page) in an `AnimatePresence` block for smooth route transitions.
- **`DarkSidebar.tsx`**: Deeply tied to business logic. It reads `WorkspaceContext` to render the Workspace Switcher, and uses `next/navigation` for routing.

## 3. Feature Components (`components/settings/`, `components/dashboard/`)
These components are heavily tied to business logic.
- **`WorkspaceTab.tsx`**: Reads `useWorkspace` and `useDashboardMetrics`. If `activeWorkspace` is null, it gracefully returns an `EmptyState`. Otherwise, it renders a complex tabbed interface with Framer Motion `layoutId` for the active tab indicator.
- **`PipelineVisualizer.tsx`**: A complex visual component in the Developer Console that maps over pipeline stages (Ingestion, Chunking, Embedding) and draws animated SVG connection lines.

## Component Reusability Rules
1. If a component relies on a specific backend API, it belongs in a feature folder (e.g., `components/documents/`).
2. If a component is purely visual (like a button or a card), it MUST go in `components/ds/`.
