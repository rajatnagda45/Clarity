# Tech Stack

## Core Technologies
### React (v19)
- **Why**: Industry standard for building reactive interfaces. The vast ecosystem and developer familiarity make it non-negotiable.
- **Where**: Everywhere.
- **Interaction**: We lean heavily on hooks (`useState`, `useEffect`, `useCallback`) and Context API.

### TypeScript
- **Why**: Catches errors at compile time, acts as self-documenting code, and provides unparalleled developer experience (intellisense).
- **Where**: End-to-end. All files are `.ts` or `.tsx`.

### Next.js (v15 App Router)
- **Why**: Provides built-in routing, layout persistence, and API routes. The App Router (`src/app`) allows us to co-locate layouts and pages logically.
- **Where**: Routing layer.

### Tailwind CSS
- **Why**: Utility-first styling framework that allows us to build complex, responsive layouts without leaving the JSX.
- **Where**: Used in every component via `className`. 

## Data Fetching & State
### React Query (TanStack Query v5)
- **Why**: Simplifies data fetching, caching, synchronization, and error handling. It eliminates the need for complex `useEffect` chains.
- **Where**: Centralized in `src/hooks/` (e.g., `useDocuments.ts`).

### React Context API
- **Why**: For global UI state that changes infrequently (e.g., active workspace, sidebar open/closed).
- **Where**: `src/contexts/` (e.g., `WorkspaceContext.tsx`).

## Authentication & Backend
### Clerk (`@clerk/nextjs`)
- **Why**: Handles the entire authentication lifecycle (sign up, sign in, session tokens) securely out of the box.
- **Where**: `src/app/(auth)/layout.tsx` and `src/app/sign-in/`.

### Supabase / FastAPI (Backend Assumption)
- **Why**: The frontend assumes a robust REST/GraphQL API. We pass the Clerk JWT token in the `Authorization` header to the backend for verification.

## Styling & Animation
### Framer Motion
- **Why**: Provides a declarative API for animations. Features like `AnimatePresence` and `layoutId` are critical for our tab switching and page transitions.
- **Where**: Extensively used in `DarkSidebar.tsx`, `DarkAppLayout.tsx`, and shared components.

### Lucide React
- **Why**: A clean, modern icon library that matches our aesthetic perfectly. Consistent 2px stroke weight.
- **Where**: Used globally for all iconography.

### `clsx` and `tailwind-merge` (`cn` utility)
- **Why**: Allows conditional tailwind classes without worrying about class collisions.
- **Where**: `src/lib/cn.ts` and design system primitives.
