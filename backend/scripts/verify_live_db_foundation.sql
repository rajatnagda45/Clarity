-- Run this in the Supabase SQL editor after applying migrations/001_initial_schema.sql
-- to verify the fresh database foundation.

-- 1. Required tables
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'workspaces','memberships','reference_clauses','documents','chunks','clauses',
    'conversations','messages','claims','answer_evals','abstentions','debate_turns',
    'contradictions','eval_runs','eval_cases','eval_case_results','quality_rollups',
    'usage_events','subscriptions'
  )
order by table_name;

-- 2. Indexes
select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'documents','chunks','clauses','messages','claims','debate_turns',
    'contradictions','usage_events'
  )
order by tablename, indexname;

-- 3. RLS enabled tables
select relname as table_name, relrowsecurity as rls_enabled
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in (
    'workspaces','memberships','documents','chunks','clauses','conversations',
    'messages','claims','answer_evals','abstentions','debate_turns',
    'contradictions','quality_rollups','usage_events','subscriptions'
  )
order by relname;

-- 4. Policies
select tablename, policyname, permissive, roles, cmd, qual
from pg_policies
where schemaname = 'public'
  and tablename in (
    'workspaces','memberships','documents','chunks','clauses','conversations',
    'messages','claims','answer_evals','abstentions','debate_turns',
    'contradictions','quality_rollups','usage_events','subscriptions'
  )
order by tablename, policyname;

-- 5. Global table exception
select relname as table_name, relrowsecurity as rls_enabled
from pg_class
where relnamespace = 'public'::regnamespace
  and relname = 'reference_clauses';
