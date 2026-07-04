# Backend Connections

The frontend acts as an aggressive consumer of the FastAPI backend. All interactions are centralized in `src/lib/api.ts`.

## Authentication Flow
1. User logs in via Clerk.
2. Clerk manages the JWT.
3. For every API request, the frontend calls `await getToken()`.
4. The token is appended as `Authorization: Bearer <token>`.

## Centralized Fetch Wrapper
We use a standard pattern for all API calls to ensure consistent error handling and type safety.

```ts
export async function listDocuments({ token, workspaceId }: { token: string; workspaceId: string }): Promise<Document[]> {
  const res = await fetch(`${API_URL}/documents?workspace_id=${workspaceId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new Error(parseApiError(errorBody, res.status));
  }
  return res.json();
}
```

## Major Flows
### 1. Workspace Flow
- **Endpoint**: `GET /users/me` (`getMe`)
- **Purpose**: Returns the user's profile and an array of their workspaces.
- **Caching**: Controlled by `WorkspaceContext`, fetches once on mount.

### 2. Document Flow
- **Endpoint**: `GET /documents` (`listDocuments`)
- **Trigger**: Navigating to `/documents` or `/developer/dashboard`.
- **Caching**: React Query handles this via `useDocuments`. Stale time is default.

### 3. Developer Metrics Flow
- **Endpoint**: `GET /workspaces/{id}/dashboard/developer`
- **Response**: Returns deep pipeline metrics (`totalStorageBytes`, `statusCounts`, `recentLogs`).

## Error Handling (`parseApiError`)
FastAPI often returns HTTP 422 with a complex `detail` array for validation errors. `parseApiError` flattens this array into a human-readable string (e.g., `"Field 'name': is required"`) so it can be passed directly to the Toast notification system.
