from __future__ import annotations

import re
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "migrations" / "001_initial_schema.sql"

REQUIRED_TABLES = {
    "workspaces",
    "memberships",
    "reference_clauses",
    "documents",
    "chunks",
    "clauses",
    "conversations",
    "messages",
    "claims",
    "answer_evals",
    "abstentions",
    "debate_turns",
    "contradictions",
    "eval_runs",
    "eval_cases",
    "eval_case_results",
    "quality_rollups",
    "usage_events",
    "subscriptions",
}

REQUIRED_INDEX_SNIPPETS = {
    "create index on documents (workspace_id);",
    "create index on chunks (document_id);",
    "create index on chunks (workspace_id);",
    "create index on clauses (document_id);",
    "create index on clauses (workspace_id);",
    "create index on messages (conversation_id);",
    "create index on claims (message_id);",
    "create index on debate_turns (message_id);",
    "create index on contradictions (workspace_id);",
    "create index on usage_events (workspace_id, created_at);",
}

REQUIRED_RLS_TABLES = {
    "workspaces",
    "memberships",
    "documents",
    "chunks",
    "clauses",
    "conversations",
    "messages",
    "claims",
    "answer_evals",
    "abstentions",
    "debate_turns",
    "contradictions",
    "quality_rollups",
    "usage_events",
    "subscriptions",
}


def main() -> int:
    sql = MIGRATION.read_text()
    found_tables = {
        match.group(1)
        for match in re.finditer(r"create table\s+([a-z_]+)\s*\(", sql, flags=re.IGNORECASE)
    }

    missing_tables = sorted(REQUIRED_TABLES - found_tables)
    missing_indexes = sorted(snippet for snippet in REQUIRED_INDEX_SNIPPETS if snippet not in sql)

    missing_rls_enables = sorted(
        table
        for table in REQUIRED_RLS_TABLES
        if f"alter table {table} enable row level security;" not in sql
    )
    missing_policies = sorted(
        table
        for table in REQUIRED_RLS_TABLES
        if f"create policy {table}_tenant_isolation on {table}" not in sql
    )

    errors: list[str] = []
    if missing_tables:
        errors.append(f"Missing tables: {', '.join(missing_tables)}")
    if missing_indexes:
        errors.append("Missing index statements:\n- " + "\n- ".join(missing_indexes))
    if missing_rls_enables:
        errors.append(f"Missing RLS enable statements: {', '.join(missing_rls_enables)}")
    if missing_policies:
        errors.append(f"Missing tenant policies: {', '.join(missing_policies)}")

    if errors:
        print("Migration contract verification failed:\n")
        for err in errors:
            print(err)
            print()
        return 1

    print("Migration contract verified successfully.")
    print(f"Tables: {len(found_tables)}")
    print(f"Required tenant RLS tables: {len(REQUIRED_RLS_TABLES)}")
    print(f"Migration file: {MIGRATION}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
