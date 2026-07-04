# Code Quality

We maintain a high bar for code quality to ensure the codebase remains legible and maintainable as the team scales.

## 1. Type Strictness
- TypeScript is used strictly. The `any` type is banned.
- All backend responses must be typed via interfaces in `src/types/clarity.ts`.

## 2. Shared Primitives vs Domain Components
- We strictly enforce the boundary between `components/ds/` (Design System) and the rest of the application.
- If a component in `ds/` imports a domain-specific context (like `useWorkspace`), it is an architectural violation. It must be refactored to accept props instead.

## 3. Naming Conventions
- **Components**: `PascalCase` (e.g., `WorkspaceDashboard.tsx`).
- **Hooks**: `camelCase` starting with `use` (e.g., `useDocuments.ts`).
- **Files**: Coincide with their primary export.

## 4. Magic Numbers & Hardcoded Values
- Banned in CSS. Use Tailwind utility classes and CSS variables.
- Banned in business logic. Use constants (e.g., `PLANS` array in `BillingTab.tsx`).
