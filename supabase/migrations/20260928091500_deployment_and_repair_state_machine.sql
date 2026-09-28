create table if not exists public.ai_deployments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ai_projects(id) on delete cascade,
  version_id uuid references public.ai_project_versions(id) on delete set null,
  provider text not null,
  environment text not null default 'preview' check (environment in ('preview','production')),
  status text not null default 'queued' check (status in ('queued','building','ready','failed','canceled','rollback_pending','rolled_back')),
  provider_deployment_id text,
  deployment_url text,
  git_ref text,
  git_commit_sha text,
  build_logs jsonb not null default '{}'::jsonb,
  error_summary text,
  requested_by uuid references auth.users(id),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_repair_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ai_projects(id) on delete cascade,
  deployment_id uuid references public.ai_deployments(id) on delete set null,
  source_run_id uuid references public.ai_build_runs(id) on delete set null,
  status text not null default 'queued' check (status in ('queued','diagnosing','planned','awaiting_approval','applying','testing','redeploying','verified','failed','canceled')),
  failure_class text,
  diagnosis jsonb not null default '{}'::jsonb,
  repair_plan jsonb not null default '{}'::jsonb,
  applied_changes jsonb not null default '{}'::jsonb,
  verification jsonb not null default '{}'::jsonb,
  attempt_no integer not null default 1,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_deployments_project_idx on public.ai_deployments(project_id,created_at desc);
create index if not exists ai_deployments_provider_idx on public.ai_deployments(provider,provider_deployment_id);
create index if not exists ai_repair_runs_project_idx on public.ai_repair_runs(project_id,created_at desc);
create index if not exists ai_repair_runs_deployment_idx on public.ai_repair_runs(deployment_id);

alter table public.ai_deployments enable row level security;
alter table public.ai_repair_runs enable row level security;

drop policy if exists ai_deployments_member_select on public.ai_deployments;
drop policy if exists ai_deployments_manager_insert on public.ai_deployments;
drop policy if exists ai_deployments_manager_update on public.ai_deployments;
drop policy if exists ai_deployments_owner_delete on public.ai_deployments;
create policy ai_deployments_member_select on public.ai_deployments for select to authenticated using (exists(select 1 from public.ai_projects p where p.id=project_id and private.user_can_business(p.business_id,null)));
create policy ai_deployments_manager_insert on public.ai_deployments for insert to authenticated with check (exists(select 1 from public.ai_projects p where p.id=project_id and private.user_can_business(p.business_id,ARRAY['owner','admin','manager'])));
create policy ai_deployments_manager_update on public.ai_deployments for update to authenticated using (exists(select 1 from public.ai_projects p where p.id=project_id and private.user_can_business(p.business_id,ARRAY['owner','admin','manager']))) with check (exists(select 1 from public.ai_projects p where p.id=project_id and private.user_can_business(p.business_id,ARRAY['owner','admin','manager'])));
create policy ai_deployments_owner_delete on public.ai_deployments for delete to authenticated using (exists(select 1 from public.ai_projects p where p.id=project_id and private.user_can_business(p.business_id,ARRAY['owner','admin'])));

drop policy if exists ai_repair_runs_member_select on public.ai_repair_runs;
drop policy if exists ai_repair_runs_manager_insert on public.ai_repair_runs;
drop policy if exists ai_repair_runs_manager_update on public.ai_repair_runs;
drop policy if exists ai_repair_runs_owner_delete on public.ai_repair_runs;
create policy ai_repair_runs_member_select on public.ai_repair_runs for select to authenticated using (exists(select 1 from public.ai_projects p where p.id=project_id and private.user_can_business(p.business_id,null)));
create policy ai_repair_runs_manager_insert on public.ai_repair_runs for insert to authenticated with check (exists(select 1 from public.ai_projects p where p.id=project_id and private.user_can_business(p.business_id,ARRAY['owner','admin','manager'])));
create policy ai_repair_runs_manager_update on public.ai_repair_runs for update to authenticated using (exists(select 1 from public.ai_projects p where p.id=project_id and private.user_can_business(p.business_id,ARRAY['owner','admin','manager']))) with check (exists(select 1 from public.ai_projects p where p.id=project_id and private.user_can_business(p.business_id,ARRAY['owner','admin','manager'])));
create policy ai_repair_runs_owner_delete on public.ai_repair_runs for delete to authenticated using (exists(select 1 from public.ai_projects p where p.id=project_id and private.user_can_business(p.business_id,ARRAY['owner','admin'])));

