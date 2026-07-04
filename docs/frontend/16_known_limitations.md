# Known Limitations

This section documents frontend UI elements that are currently "stubbed" or waiting on backend API implementations. Do not attempt to fix these in the frontend without corresponding backend changes.

1. **Stripe Billing**: The `BillingTab.tsx` calculates usage percentages, but the "Upgrade to Pro" checkout button is disabled and displays a placeholder message.
2. **Role Management**: The `WorkspaceTab.tsx` has tabs for "Members" and "Roles", but these are currently displaying "Initializing" placeholders because the backend endpoints for RBAC (Role-Based Access Control) do not exist yet.
3. **Chat Streaming**: The Chat interface needs to handle Server-Sent Events (SSE) for streaming text, which requires specific backend support.
4. **Document Labels/Archiving**: The UI has buttons for labeling and archiving documents, but clicking them currently triggers a "Coming Soon" toast, as the backend only supports `delete`.
