-- Durable AI Build Engine schema. The live project was initialized with the same DDL.
create table if not exists public.ai_build_runs (id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade, workspace_id uuid references public.workspaces(id) on delete set null, created_by uuid not null references auth.users(id) on delete restrict, capability_key text not null, request_text text not null, status text not null default 'queued' check (status = any (array['queued','planning','building','testing','waiting_approval','succeeded','partial','failed','cancelled'])), execution_mode text not null default 'ask_first' check (execution_mode = any (array['draft_only','ask_first','auto_execute'])), provider_key text, provider_status text not null default 'not_configured' check (provider_status = any (array['not_configured','available','failed','fallback'])), plan jsonb not null default '{}'::jsonb, context jsonb not null default '{}'::jsonb, result jsonb not null default '{}'::jsonb, error_message text, idempotency_key text, started_at timestamptz, finished_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create unique index if not exists ai_build_runs_business_idempotency_uidx on public.ai_build_runs(business_id,idempotency_key) where idempotency_key is not null;
create table if not exists public.ai_build_steps (id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade, build_run_id uuid not null references public.ai_build_runs(id) on delete cascade, sequence_no integer not null, step_key text not null, step_type text not null default 'workflow', status text not null default 'queued' check (status = any (array['queued','running','succeeded','skipped','waiting_approval','failed'])), input jsonb not null default '{}'::jsonb, output jsonb not null default '{}'::jsonb, requires_approval boolean not null default false, error_message text, started_at timestamptz, finished_at timestamptz, created_at timestamptz not null default now());
create unique index if not exists ai_build_steps_run_sequence_uidx on public.ai_build_steps(build_run_id,sequence_no);
create table if not exists public.ai_build_artifacts (id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade, build_run_id uuid not null references public.ai_build_runs(id) on delete cascade, artifact_type text not null, artifact_key text not null, version integer not null default 1, status text not null default 'draft' check (status = any (array['draft','validated','published','superseded','rejected'])), content jsonb not null default '{}'::jsonb, checksum text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.ai_build_tests (id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade, build_run_id uuid not null references public.ai_build_runs(id) on delete cascade, test_key text not null, test_type text not null default 'structural', status text not null default 'pending' check (status = any (array['pending','passed','failed','skipped'])), assertion jsonb not null default '{}'::jsonb, actual jsonb not null default '{}'::jsonb, error_message text, created_at timestamptz not null default now(), completed_at timestamptz);
alter table public.ai_build_runs enable row level security;
alter table public.ai_build_steps enable row level security;
alter table public.ai_build_artifacts enable row level security;
alter table public.ai_build_tests enable row level security;
create unique index if not exists ai_build_runs_business_idempotency_uidx on public.ai_build_runs(business_id,idempotency_key) where idempotency_key is not null;
create index if not exists ai_build_runs_business_status_idx on public.ai_build_runs(business_id,status,created_at desc);
create unique index if not exists ai_build_steps_run_sequence_uidx on public.ai_build_steps(build_run_id,sequence_no);
create index if not exists ai_build_steps_business_run_idx on public.ai_build_steps(business_id,build_run_id,sequence_no);
create unique index if not exists ai_build_artifacts_run_key_version_uidx on public.ai_build_artifacts(build_run_id,artifact_key,version);
create index if not exists ai_build_artifacts_business_key_idx on public.ai_build_artifacts(business_id,artifact_type,artifact_key,created_at desc);
create index if not exists ai_build_tests_business_run_idx on public.ai_build_tests(business_id,build_run_id,status);

drop policy if exists ai_build_runs_owner_select on public.ai_build_runs;
create policy ai_build_runs_owner_select on public.ai_build_runs for select to authenticated
using (exists (select 1 from public.businesses b where b.id=ai_build_runs.business_id and b.owner_id=(select auth.uid())));
drop policy if exists ai_build_runs_owner_insert on public.ai_build_runs;
create policy ai_build_runs_owner_insert on public.ai_build_runs for insert to authenticated
with check (exists (select 1 from public.businesses b where b.id=ai_build_runs.business_id and b.owner_id=(select auth.uid())) and created_by=(select auth.uid()));
drop policy if exists ai_build_runs_owner_update on public.ai_build_runs;
create policy ai_build_runs_owner_update on public.ai_build_runs for update to authenticated
using (exists (select 1 from public.businesses b where b.id=ai_build_runs.business_id and b.owner_id=(select auth.uid())))
with check (exists (select 1 from public.businesses b where b.id=ai_build_runs.business_id and b.owner_id=(select auth.uid())));

drop policy if exists ai_build_steps_owner_all on public.ai_build_steps;
create policy ai_build_steps_owner_all on public.ai_build_steps for all to authenticated
using (exists (select 1 from public.businesses b where b.id=ai_build_steps.business_id and b.owner_id=(select auth.uid())))
with check (exists (select 1 from public.businesses b where b.id=ai_build_steps.business_id and b.owner_id=(select auth.uid())));

drop policy if exists ai_build_artifacts_owner_all on public.ai_build_artifacts;
create policy ai_build_artifacts_owner_all on public.ai_build_artifacts for all to authenticated
using (exists (select 1 from public.businesses b where b.id=ai_build_artifacts.business_id and b.owner_id=(select auth.uid())))
with check (exists (select 1 from public.businesses b where b.id=ai_build_artifacts.business_id and b.owner_id=(select auth.uid())));

drop policy if exists ai_build_tests_owner_all on public.ai_build_tests;
create policy ai_build_tests_owner_all on public.ai_build_tests for all to authenticated
using (exists (select 1 from public.businesses b where b.id=ai_build_tests.business_id and b.owner_id=(select auth.uid())))
with check (exists (select 1 from public.businesses b where b.id=ai_build_tests.business_id and b.owner_id=(select auth.uid())));
