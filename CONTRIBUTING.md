# Contributing to Clarity AI Docs

## Development Setup

### Prerequisites
- Python 3.11+
- Node.js 20+
- Poetry 2.4.1
- Docker and Docker Compose

### Backend
```bash
cd backend
poetry install
cp .env.example .env   # fill in required values
poetry run uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Full Stack (Docker Compose)
```bash
docker-compose up
```

## Code Standards

### Python
- Formatter: `ruff format .`
- Linter: `ruff check .`
- All new code must pass `ruff check` before merging
- Type annotations required on all function signatures
- No `print()` statements — use `logging`

### TypeScript / React
- All new components: `'use client'` or `'use server'` directive explicit
- No `any` type unless justified with a comment
- Imports: absolute paths via `@/` alias

### Security Rules (non-negotiable)
- Every DB mutation must include `.eq("workspace_id", workspace_id)` when using the service role client
- Never store plaintext credentials, tokens, or API keys
- All new tables must have RLS enabled with a tenant isolation policy
- JWT validation must never be bypassed, even in test helpers

### No Placeholders
- Every shipped function must be implemented — no `pass`, `TODO`, or stub returns
- Hardcoded trust scores, simulated tool outputs, or `hash(user_input)` patterns are not acceptable in production code

## Running Tests

### Backend
```bash
cd backend
poetry run pytest -q
```

### Frontend
```bash
cd frontend
npm test
npm run build   # verify production build succeeds
```

## Pull Request Process

1. Branch from `main` using naming convention: `feat/<scope>`, `fix/<scope>`, `infra/<scope>`
2. All CI checks must pass (ruff, pytest, tsc, next lint, vitest)
3. Migrations require a corresponding rollback file in `migrations/rollback/`
4. Security-relevant changes require a description of the threat model in the PR body
5. No AI tool names in commit messages, PR titles, or descriptions

## Migration Guidelines

- Migrations are numbered sequentially: `NNN_description.sql`
- All new tables must have:
  - `id uuid primary key default gen_random_uuid()`
  - `workspace_id uuid not null references workspaces(id) on delete cascade`
  - `created_at timestamptz not null default now()`
  - `ALTER TABLE <name> ENABLE ROW LEVEL SECURITY;`
  - A tenant isolation policy using the established pattern
- Migrations must be idempotent (`CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS`)
- A rollback script is required for every forward migration
