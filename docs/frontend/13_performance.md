# Performance Architecture

High performance is critical for an application handling large datasets and AI streaming.

## 1. Bundle Splitting & Lazy Loading
- **Next.js App Router**: Automatically code-splits by route. The `/dashboard` code is not loaded when a user is on `/documents`.
- **Dynamic Imports**: Used for heavy components like charts. For example, `recharts` or complex `framer-motion` SVGs can be dynamically imported with `next/dynamic` to reduce the initial bundle size.

## 2. React Query Caching
- **Stale-While-Revalidate**: Data is immediately shown from the cache while a background request checks for updates.
- **Deduplication**: If two components request `useDocuments()` simultaneously, React Query merges them into a single network request.

## 3. Memoization
- We use `useCallback` and `useMemo` strategically. In `WorkspaceContext`, the `load` function is wrapped in `useCallback` to prevent infinite loops in the `useEffect` dependency array.
- However, we avoid premature memoization of simple UI components, as React 19 is highly optimized.

## 4. Visual Rendering
- **Animation Offloading**: CSS transforms and `opacity` are preferred for Framer Motion, as they run on the GPU and do not trigger layout recalculations.
