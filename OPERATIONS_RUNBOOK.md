# Operations Runbook — Clarity AI Docs v1.0

## Health Checks

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Basic liveness — always returns 200 |
| `GET /health/live` | Liveness — uptime, always 200 |
| `GET /health/ready` | Readiness — checks DB, Redis, queue depth |
| `GET /api/metrics` | Internal metrics snapshot (developer only) |

### Interpreting `/health/ready`

```json
{
  "status": "ready",
  "checks": {
    "database": {"ok": true},
    "redis": {"ok": true},
    "queue": {"ok": true, "depth": 0},
    "workers": {"ok": true, "count": 2}
  }
}
```

- `status: "degraded"` — Redis or queue unavailable; app serving but at reduced capacity
- `status: "unavailable"` — Database unreachable; app returning 503

## Common Operations

### Scaling

```bash
# Scale API pods
kubectl scale deployment clarity-api -n clarity --replicas=4

# Scale workers (for high queue depth)
kubectl scale deployment clarity-worker -n clarity --replicas=8
```

### Restarting Pods

```bash
kubectl rollout restart deployment/clarity-api -n clarity
kubectl rollout restart deployment/clarity-worker -n clarity
```

### Viewing Logs

```bash
# API logs (structured key=value format)
kubectl logs -n clarity -l app=clarity-api --tail=100 -f

# Worker logs
kubectl logs -n clarity -l app=clarity-worker --tail=100 -f

# Filter for errors
kubectl logs -n clarity -l app=clarity-api | grep "level=ERROR"
```

### Dead Letter Queue

Failed ARQ jobs are stored in `dlq:aborted_jobs` (Redis list, capped at 1000):

```bash
redis-cli LRANGE dlq:aborted_jobs 0 9   # view last 10 failures
redis-cli LLEN dlq:aborted_jobs          # count
```

Each entry is JSON:
```json
{
  "job_id": "...",
  "function": "run_document_ingestion",
  "error": "...",
  "traceback": "...",
  "timestamp": "2026-07-05T...",
  "args": [...]
}
```

To reprocess a failed document:
```bash
# Via admin API or direct re-trigger from the documents UI
# The ingestion job is deduplicated by document_id, so re-uploading is safe
```

### Rate Limit Investigation

```bash
# Check if a user is rate-limited (key format: rl:{workspace_id}:{user_id}:{path})
redis-cli KEYS "rl:*" | head -20
redis-cli GET "rl:{workspace_id}:{user_id}:{normalized_path}"
```

### Clearing Role Cache

If a user's role changes and they need immediate access:
```bash
redis-cli DEL "role:{workspace_id}:{user_id}"
```

## Monitoring

### Key Metrics to Watch

| Metric | Alert Threshold |
|--------|----------------|
| API pod CPU | > 80% for 5min |
| API pod memory | > 900 Mi |
| Worker pod CPU | > 70% for 5min |
| Queue depth | > 500 jobs |
| DLQ length | > 10 entries |
| `/health/ready` status | `degraded` for 2min |

### Log Patterns for Alerts

```
level=ERROR                    # Any application error
"Failed to enqueue"            # ARQ enqueue failures
"Production config validation" # Startup failures
"JWKS fetch failed"            # Auth infrastructure issue
"rate_limit_exceeded"          # User hitting limits
```

## Database Maintenance

### Checking RLS Coverage

```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public'
EXCEPT
SELECT tablename FROM pg_policies WHERE schemaname = 'public'
ORDER BY tablename;
```

This should return only tables intentionally left without RLS (e.g. `reference_clauses`).

### Index Health

```sql
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY tablename;
```

Zero-scan indexes are candidates for removal. Review before dropping.

### Connection Limits

Supabase connection pooling: the service role client uses the pooler URL by default.
If seeing connection exhaustion errors, verify `SUPABASE_URL` ends in `/rest/v1` and points to the pooler.
