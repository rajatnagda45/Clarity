# Folder Structure

The frontend is strictly organized to separate routing from UI, and business logic from presentation.

```mermaid
graph TD
    src[src/]
    src --> app[app/]
    src --> components[components/]
    src --> contexts[contexts/]
    src --> hooks[hooks/]
    src --> lib[lib/]
    src --> types[types/]
    
    app --> auth[(auth)/]
    app --> globals[globals.css]
    
    components --> ds[ds/]
    components --> layout[layout/]
    components --> dashboard[dashboard/]
    components --> settings[settings/]
```

## Deep Dive

### `src/app/` (Routing & Layouts)
The Next.js App Router folder. Contains the actual routes the user visits.
- **`(auth)/`**: A route group for authenticated pages. Contains the master `layout.tsx` that enforces Clerk authentication.
- **`globals.css`**: The global stylesheet containing our Tailwind directives and CSS variables (design tokens).

### `src/components/` (React Components)
The heart of the UI. Subdivided logically:
- **`ds/` (Design System)**: Pure, reusable UI primitives. E.g., `Dialog.tsx`, `EmptyState.tsx`, `Progress.tsx`. These components know NOTHING about business logic or backend APIs.
- **`layout/`**: Shell components. E.g., `DarkAppLayout.tsx`, `DarkSidebar.tsx`, `DarkTopbar.tsx`.
- **`dashboard/` & `settings/`**: Feature-specific components. E.g., `WorkspaceTab.tsx`, `PipelineVisualizer.tsx`.

### `src/contexts/` (Global State)
React Context providers.
- **`WorkspaceContext.tsx`**: Fetches and stores the user's workspaces and tracks the `activeWorkspace`. This is the most critical context in the app.
- **`UIContext.tsx`**: Manages sidebar state (collapsed/open).
- **`CommandContext.tsx`**: Manages the Cmd+K global search palette.

### `src/hooks/` (Data Fetching & Logic)
Custom React hooks wrapping React Query.
- **`useDocuments.ts`**: Fetches the document list for the active workspace.
- **`useDashboardMetrics.ts`**: Fetches analytics and RAG pipeline data.

### `src/lib/` (Utilities)
- **`api.ts`**: The central API client. Contains all `fetch` wrappers and the `parseApiError` utility.
- **`cn.ts`**: The Tailwind class merger utility.

### `src/types/` (TypeScript Types)
- **`clarity.ts`**: Global interfaces defining `Workspace`, `Document`, etc.
