# Developer Guide

Welcome to the Clarity Frontend. Here is how you can contribute effectively.

## 1. Adding a New Page
1. Create a new folder in `src/app/(auth)/your-feature/`.
2. Add a `page.tsx` file.
3. Structure it as a "Thin Page":
```tsx
export default function YourFeaturePage() {
  return (
    <div className="relative min-h-screen bg-[var(--color-bg-base)]">
      {/* Backgrounds */}
      <div className="mx-auto flex w-full max-w-[1000px] flex-col relative z-10">
        <YourFeatureClientComponent />
      </div>
    </div>
  );
}
```

## 2. Connecting a New Backend API
1. Define the TypeScript interfaces in `src/types/clarity.ts`.
2. Write the fetch wrapper in `src/lib/api.ts`. Use `parseApiError` for error handling.
3. Create a hook in `src/hooks/` using TanStack Query.
```tsx
export function useYourFeature() {
  const { getToken } = useAuth();
  const { activeWorkspace } = useWorkspace();
  return useQuery({
    queryKey: ['your-feature', activeWorkspace?.id],
    queryFn: async () => { /* call api */ },
    enabled: !!activeWorkspace
  });
}
```

## 3. Creating Animations
Always use `framer-motion`. Never use raw CSS transitions for mount/unmount animations.
```tsx
import { motion } from 'framer-motion';

<motion.div
  initial={{ opacity: 0, y: 10 }}
  animate={{ opacity: 1, y: 0 }}
>
```
