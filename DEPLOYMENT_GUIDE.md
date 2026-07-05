# Deployment Guide — Clarity AI Docs v1.0

## Prerequisites

| Requirement | Version |
|-------------|---------|
| Kubernetes  | 1.27+   |
| kubectl     | 1.27+   |
| Helm        | 3.x     |
| cert-manager | 1.x   |
| nginx-ingress | latest |
| Docker      | 24+     |

## Environment Variables

All secrets are injected via the `clarity-secrets` Kubernetes Secret.
All non-secret config is in the `clarity-config` ConfigMap.

### Required Secrets (`clarity-secrets`)

| Key | Description |
|-----|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (never expose to clients) |
| `SUPABASE_JWT_SECRET` | JWT signing secret (HS256 dev/test only) |
| `OPENAI_API_KEY` | OpenAI API key |
| `PINECONE_API_KEY` | Pinecone vector store key |
| `CLERK_SECRET_KEY` | Clerk backend secret key |
| `DODO_API_KEY` | Dodo Payments API key |
| `DODO_WEBHOOK_SECRET` | **Required in production** — Dodo Payments webhook signing secret |
| `DODO_PRODUCT_ID_PRO` | Dodo Product ID for the Pro plan |
| `DODO_PRODUCT_ID_TEAM` | Dodo Product ID for the Team plan |
| `REDIS_URL` | Redis connection URL (e.g. `rediss://...` for TLS) |
| `REDIS_PASSWORD` | Redis auth password |
| `COHERE_API_KEY` | Cohere rerank key |

### Required ConfigMap (`clarity-config`)

| Key | Example |
|-----|---------|
| `ENVIRONMENT` | `production` |
| `ALLOWED_ORIGINS` | `https://clarity.ai` |
| `LOG_LEVEL` | `INFO` |

## Step-by-Step Deployment

### 1. Create Namespace
```bash
kubectl apply -f k8s/namespace.yaml
```

### 2. Create Secrets
```bash
kubectl create secret generic clarity-secrets \
  --namespace clarity \
  --from-literal=SUPABASE_URL=<value> \
  --from-literal=SUPABASE_SERVICE_ROLE_KEY=<value> \
  --from-literal=SUPABASE_JWT_SECRET=<value> \
  --from-literal=OPENAI_API_KEY=<value> \
  --from-literal=PINECONE_API_KEY=<value> \
  --from-literal=CLERK_SECRET_KEY=<value> \
  --from-literal=DODO_API_KEY=<value> \
  --from-literal=DODO_WEBHOOK_SECRET=<value> \
  --from-literal=DODO_PRODUCT_ID_PRO=<value> \
  --from-literal=DODO_PRODUCT_ID_TEAM=<value> \
  --from-literal=REDIS_URL=<value> \
  --from-literal=REDIS_PASSWORD=<value> \
  --from-literal=COHERE_API_KEY=<value>
```

### 3. Apply ConfigMap
```bash
kubectl apply -f k8s/configmap.yaml
```

Edit `k8s/configmap.yaml` first to set `ENVIRONMENT: production` and `ALLOWED_ORIGINS`.

### 4. Run Database Migrations

Migrations must be run manually against Supabase before deploying the application.

```bash
# Apply in order — each migration depends on previous ones
psql $DATABASE_URL -f migrations/001_initial_schema.sql
psql $DATABASE_URL -f migrations/002_document_ingestion_pipeline.sql
# ... repeat for 003–016
psql $DATABASE_URL -f migrations/016_benchmark_platform.sql
```

**Important**: Migrations 009 and 010 created some tables without RLS policies (deferred as manual steps). Run migration 011 to apply the RLS policies for those tables. Verify no tables are missing RLS with:
```sql
SELECT schemaname, tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT IN (SELECT tablename FROM pg_policies WHERE schemaname = 'public')
ORDER BY tablename;
```

### 5. Deploy Redis (Development/Staging Only)
```bash
kubectl apply -f k8s/redis.yaml
```
> **Production**: Use Upstash, AWS ElastiCache, or Redis Sentinel instead. Remove `k8s/redis.yaml` from your production deploy and set `REDIS_URL` in secrets to the managed service endpoint.

### 6. Build and Push Images

```bash
# API image
docker build -t your-registry/clarity-api:1.0.0 backend/
docker push your-registry/clarity-api:1.0.0

# Worker image
docker build -t your-registry/clarity-worker:1.0.0 -f backend/Dockerfile.worker backend/
docker push your-registry/clarity-worker:1.0.0
```

Update `k8s/api-deployment.yaml` and `k8s/worker-deployment.yaml` to reference the tagged image versions (replace `latest`).

### 7. Deploy API and Worker
```bash
kubectl apply -f k8s/api-deployment.yaml
kubectl apply -f k8s/worker-deployment.yaml
```

### 8. Deploy Ingress
```bash
kubectl apply -f k8s/ingress.yaml
```

Edit `k8s/ingress.yaml` first to set the correct domain and `cors-allow-origin` annotation.

### 9. Verify Deployment
```bash
kubectl get pods -n clarity
kubectl logs -n clarity deploy/clarity-api --tail=50
kubectl logs -n clarity deploy/clarity-worker --tail=50

# Health check
curl https://api.clarity.ai/health/ready
```

Expected response:
```json
{"status": "ready", "checks": {"database": {"ok": true}, ...}}
```

## Rolling Deployments

The API deployment is configured for zero-downtime rolling updates:
- `maxUnavailable: 0` — no pods taken offline during update
- `maxSurge: 1` — one extra pod started before old ones stop
- `preStop: sleep 5` — drains in-flight requests before SIGTERM

The worker deployment uses the same pattern. Workers gracefully finish their current job before shutdown (`terminationGracePeriodSeconds: 3600`).

## Rollback

If a deployment goes wrong:
```bash
kubectl rollout undo deployment/clarity-api -n clarity
kubectl rollout undo deployment/clarity-worker -n clarity
```

For database rollback:
```bash
# Run the appropriate rollback script
psql $DATABASE_URL -f migrations/rollback/016_rollback.sql
```
