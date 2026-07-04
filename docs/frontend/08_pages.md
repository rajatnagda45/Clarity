# Page-by-Page Breakdown

## `/developer/dashboard` (Developer Console)
- **Purpose**: Exposes the internal state of the RAG pipeline to power users.
- **Components**: `WorkspaceDashboard`, `PipelineVisualizer`, `DocumentPipelineTable`.
- **Data Sources**: `useDashboardMetrics()` which calls `getDeveloperDashboard` and `getAnswerMetrics`.
- **Empty States**: If `activeWorkspace` is null, returns `NoWorkspaceEmptyState`.

## `/workspace` (Workspace Settings)
- **Purpose**: Allow users to manage their current tenant, invite members, and view API keys.
- **Components**: `WorkspaceTab`, `EmptyState`.
- **Loading States**: Handled by the `animate-in fade-in` classes.
- **Error States**: Handled via global Toasts.

## `/billing` (Billing & Subscription)
- **Purpose**: Subscription management and quota usage display.
- **Components**: `BillingTab`, `EmptyState`.
- **Data Sources**: Calculates percentages based on hardcoded `PLANS` array and `devDashboard.data.totalStorageBytes`.
- **Future Improvements**: Actual Stripe Elements integration.

## `/documents` (Document Management)
- **Purpose**: The central ingestion hub.
- **Components**: `DocumentList`, `UploadArea` (to be finalized).
- **Backend APIs**: `listDocuments`, `deleteDocument`, `uploadDocument`.
- **Animations**: Document cards stagger in using Framer Motion.

## `/chat` (AI Chat)
- **Purpose**: Conversational interface to query ingested documents.
- **Components**: Chat message bubbles, input area, source citations.
- **Backend APIs**: Chat completion API (streaming expected).

## `/` (Landing Page)
- **Purpose**: Marketing and conversion.
- **Components**: `LandingNavbar`, `HeroSection`, `PremiumBackground`, `HowClarityWorks`.
- **Animations**: Extensive use of `framer-motion` `useScroll` and `useTransform` for scroll-linked animations.
