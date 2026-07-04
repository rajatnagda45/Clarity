# Routing Architecture

Clarity utilizes the Next.js 15 App Router paradigm.

## Directory Map

| Route Path | Physical Folder | Purpose |
|------------|-----------------|---------|
| `/` | `src/app/page.tsx` | Landing page marketing site. |
| `/sign-in/*` | `src/app/sign-in/[[...sign-in]]/page.tsx` | Clerk Sign-in UI. |
| `/sign-up/*` | `src/app/sign-up/[[...sign-up]]/page.tsx` | Clerk Sign-up UI. |
| `/dashboard` | `src/app/(auth)/dashboard/page.tsx` | Main user dashboard. |
| `/developer/dashboard` | `src/app/(auth)/developer/dashboard/page.tsx` | RAG Pipeline analytics. |
| `/documents` | `src/app/(auth)/documents/page.tsx` | Document management. |
| `/chat` | `src/app/(auth)/chat/page.tsx` | Interactive RAG Chat. |
| `/collections` | `src/app/(auth)/collections/page.tsx` | Document grouping. |
| `/eval` | `src/app/(auth)/eval/page.tsx` | Evaluation and Analytics. |
| `/workspace` | `src/app/(auth)/workspace/page.tsx` | Workspace configuration. |
| `/billing` | `src/app/(auth)/billing/page.tsx` | Stripe / Subscription management. |

## Layouts & Nested Routing
The `(auth)` folder is a Route Group. It does not affect the URL path, but it allows us to share a layout across all protected routes.

```tsx
// src/app/(auth)/layout.tsx
export default async function ProtectedLayout({ children }) {
  const { userId } = await auth();
  if (!userId) redirect('/');
  return <DarkAppLayout>{children}</DarkAppLayout>;
}
```

## "Thin Page" Architecture
Notice that most Next.js `page.tsx` files in the App Router do very little.
For example, `workspace/page.tsx`:
```tsx
export default function WorkspacePage() {
  return (
    <div className="relative min-h-screen bg-[var(--color-bg-base)] ...">
      <PremiumBackground glowOpacity={0.1} />
      <div className="mx-auto flex w-full max-w-[1000px] ...">
        <WorkspaceTab />
      </div>
    </div>
  );
}
```
**Tradeoff**: By keeping pages thin, we offload complex interactive logic to Client Components (like `WorkspaceTab`), which keeps Server Components clean and reduces hydration complexity.
