# Incident Response — Clarity AI Docs v1.0

## Severity Definitions

| Level | Description | Response Time |
|-------|-------------|---------------|
| P0 | Production down, data loss risk, security breach | Immediate |
| P1 | Core feature unavailable for all users | 30 minutes |
| P2 | Core feature degraded or unavailable for some users | 2 hours |
| P3 | Non-critical feature unavailable | Next business day |

## P0 Response Checklist

1. **Acknowledge** — Post in #incidents Slack channel: "Investigating P0: [symptom]"
2. **Assess** — Check `/health/ready`, pod status, recent deployments
3. **Isolate** — Is it one pod? All pods? DB? Redis? External API?
4. **Rollback if caused by deploy** — `kubectl rollout undo deployment/clarity-api -n clarity`
5. **Mitigate** — Scale up, redirect traffic, or disable the affected feature
6. **Communicate** — Update status page within 10 minutes of detection
7. **Resolve** — Fix root cause; do not leave mitigations in place longer than 24h
8. **Post-mortem** — Written within 48h of resolution

## Common Incidents

### API Pods Crashing (OOMKilled)

**Symptoms**: Pods restarting, `OOMKilled` status
**Cause**: Likely `list_conversations` or `get_answer_explorer` loading unbounded workspace data
**Mitigation**:
```bash
kubectl top pod -n clarity -l app=clarity-api
kubectl describe pod -n clarity <pod-name>
# If OOMKilled:
kubectl scale deployment clarity-api --replicas=6 -n clarity   # spread load
```
**Fix**: Add `LIMIT` clauses to unbounded queries in `conversations.py` and `developer.py`

### Database Unreachable

**Symptoms**: `/health/ready` returns `"status": "unavailable"`, `"database": {"ok": false}`
**Mitigation**:
- Verify Supabase status at status.supabase.com
- Check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are correct in secrets
- API pods will return 503 until DB recovers — no action needed

### Redis Unreachable

**Symptoms**: `/health/ready` returns `"status": "degraded"`, `"redis": {"ok": false}`
**Impact**: Rate limiting disabled (fail-open), role cache bypassed (DB fallback active), queue jobs not processing
**Mitigation**:
- If using k8s Redis pod: `kubectl rollout restart deployment/redis -n clarity`
- If using managed Redis: check provider status page
- Workers will reconnect automatically when Redis recovers

### Queue Depth Spike

**Symptoms**: DLQ growing, documents stuck in `processing` status, `queue.depth > 500`
**Mitigation**:
```bash
kubectl scale deployment clarity-worker --replicas=10 -n clarity
redis-cli LLEN dlq:aborted_jobs   # check for systemic failures
```
**Investigation**: Check worker logs for repeated error patterns

### JWT Validation Failures (401 spike)

**Symptoms**: Sudden spike in 401 responses, users logged out
**Likely cause**: Clerk key rotation + stale JWKS cache
**Resolution**: Restart API pods (JWKS cache is process-level and will refetch on restart)
```bash
kubectl rollout restart deployment/clarity-api -n clarity
```

### Dodo Payments Webhook Rejection

**Symptoms**: Billing plan not updating after payment, webhook signature failures
**Check**: Is `DODO_WEBHOOK_SECRET` set and matching the Dodo Payments dashboard?
```bash
kubectl get secret clarity-secrets -n clarity -o jsonpath='{.data.DODO_WEBHOOK_SECRET}' | base64 -d
```

### Security Breach Suspected

**Immediate actions**:
1. Rotate all secrets: Supabase service role key, Clerk secret, Dodo Payments API key
2. Invalidate all active sessions via Clerk dashboard
3. Review `audit_logs` table for anomalous activity
4. Check Supabase logs for unexpected queries
5. File a security report following SECURITY.md
