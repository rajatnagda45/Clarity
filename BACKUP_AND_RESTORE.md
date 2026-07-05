# Backup and Restore — Clarity AI Docs v1.0

## What Needs to Be Backed Up

| Data | Storage | Backup Method |
|------|---------|---------------|
| Workspace documents (text, metadata) | Supabase (Postgres) | Supabase PITR |
| Vector embeddings | Pinecone | Pinecone namespace export |
| File uploads (PDFs, DOCX) | Cloudflare R2 / local storage | R2 versioning or S3 bucket policy |
| Redis data (job queue, cache) | Redis | Optional — ephemeral; jobs re-trigger on document re-upload |
| Configuration | Kubernetes Secrets / ConfigMaps | Store encrypted in version control or Vault |

## Database Backup (Supabase)

Supabase Pro and Team plans include Point-in-Time Recovery (PITR).

### Enable PITR
1. Go to Supabase Dashboard → Settings → Database
2. Enable "Point in Time Recovery"
3. Set retention to minimum 7 days (recommend 30 days for enterprise)

### Manual Export
```bash
pg_dump $DATABASE_URL --no-owner --schema=public -f backup_$(date +%Y%m%d).sql
```

### Restore from Export
```bash
psql $RESTORE_DATABASE_URL < backup_20260705.sql
```

After restore, re-run any migrations that post-date the backup:
```bash
psql $RESTORE_DATABASE_URL -f migrations/016_benchmark_platform.sql
```

## Vector Store Backup (Pinecone)

Pinecone does not support native exports. Document embeddings can be regenerated from the source documents.

**Recovery procedure** for a full vector store loss:
1. Set all documents with `status = 'indexed'` back to `status = 'pending'`
2. Trigger re-ingestion for all workspace documents
3. The ingestion pipeline will re-embed and re-index automatically

```sql
UPDATE documents SET status = 'pending', indexed_at = NULL
WHERE status = 'indexed';
```

## File Storage Backup (Cloudflare R2)

Enable versioning on the R2 bucket:
```bash
# Via Cloudflare API or dashboard
# Enable "Object Versioning" on the R2 bucket settings
```

For local development storage (`/tmp/clarity-uploads`), no backup is required as files are re-uploadable.

## Redis Backup

Redis data in Clarity is ephemeral (caches, rate limits, job queue). Recovery is automatic:
- **Rate limit counters**: expire on their own TTL
- **Role cache**: refilled from DB on next request
- **Job queue**: documents stuck in `processing` can be re-triggered manually or via document re-upload

If you require Redis persistence:
1. Switch from `emptyDir` to a `PersistentVolumeClaim` in `k8s/redis.yaml`
2. Or use a managed Redis service (Upstash, ElastiCache) which includes persistence

## Disaster Recovery RTO/RPO

| Scenario | RPO | RTO |
|----------|-----|-----|
| Single pod failure | 0 (HA) | < 1 min |
| Zone failure | 0 (if multi-zone k8s) | 2–5 min |
| Full database loss (PITR available) | ≤ 1 hour | 30–60 min |
| Full database loss (from export) | ≤ 24 hours | 2–4 hours |
| Vector store loss | N/A (re-indexable) | Hours (depends on document count) |

## Backup Verification

Monthly procedure:
1. Restore database from most recent backup into a staging environment
2. Run health check: `curl https://staging-api.clarity.ai/health/ready`
3. Verify at least 3 workspaces and 10 documents are queryable
4. Document the restore time in the incident log
