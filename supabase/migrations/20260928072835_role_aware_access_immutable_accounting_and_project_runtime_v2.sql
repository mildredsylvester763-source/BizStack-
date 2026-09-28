create schema if not exists private;

create or replace function private.user_has_workspace_role(
  p_workspace_id uuid,
  p_roles text[] default null
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = (select auth.uid())
      and wm.status = 'active'
      and (p_roles is null or wm.role = any(p_roles))
  );
$$;

revoke all on function private.user_has_workspace_role(uuid, text[]) from public;
grant execute on function private.user_has_workspace_role(uuid, text[]) to authenticated;

create or replace function private.user_can_business(
  p_business_id uuid,
  p_roles text[] default null
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.businesses b
    where b.id = p_business_id
      and (
        b.owner_id = (select auth.uid())
        or (
          b.workspace_id is not null
          and private.user_has_workspace_role(b.workspace_id, p_roles)
        )
      )
  );
$$;

revoke all on function private.user_can_business(uuid, text[]) from public;
grant execute on function private.user_can_business(uuid, text[]) to authenticated;

drop policy if exists "workspace member read" on public.workspaces;
create policy "workspace members can view workspaces"
on public.workspaces
for select to authenticated
using (owner_id = (select auth.uid()) or private.user_has_workspace_role(id, null));

drop policy if exists "workspace owner all" on public.workspaces;

drop policy if exists "Users can view their own business" on public.businesses;
create policy "workspace members can view businesses"
on public.businesses
for select to authenticated
using (
  owner_id = (select auth.uid())
  or (workspace_id is not null and private.user_has_workspace_role(workspace_id, null))
);

do $$
declare
  t text;
  p record;
begin
  for p in
    select tablename, policyname
    from pg_policies
    where schemaname='public'
      and tablename in (
        select table_name
        from information_schema.columns
        where table_schema='public' and column_name='business_id'
      )
      and (
        coalesce(qual,'') ilike '%owner_id =%'
        or coalesce(with_check,'') ilike '%owner_id =%'
        or policyname ilike '%Users manage their own%'
        or policyname ilike '%Business owners can%'
      )
  loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  end loop;

  for t in
    select table_name
    from information_schema.columns
    where table_schema='public' and column_name='business_id'
    group by table_name
    order by table_name
  loop
    if t in ('businesses') then continue; end if;

    execute format('drop policy if exists %I on public.%I', t||'_member_select', t);
    execute format('create policy %I on public.%I for select to authenticated using (private.user_can_business(business_id, null))', t||'_member_select', t);

    execute format('drop policy if exists %I on public.%I', t||'_manager_insert', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.user_can_business(business_id, ARRAY[''owner'',''admin'',''manager'',''accountant'']))', t||'_manager_insert', t);

    execute format('drop policy if exists %I on public.%I', t||'_manager_update', t);
    execute format('create policy %I on public.%I for update to authenticated using (private.user_can_business(business_id, ARRAY[''owner'',''admin'',''manager'',''accountant''])) with check (private.user_can_business(business_id, ARRAY[''owner'',''admin'',''manager'',''accountant'']))', t||'_manager_update', t);

    execute format('drop policy if exists %I on public.%I', t||'_owner_delete', t);
    execute format('create policy %I on public.%I for delete to authenticated using (private.user_can_business(business_id, ARRAY[''owner'',''admin'']))', t||'_owner_delete', t);
  end loop;
end $$;

create table if not exists public.chart_of_accounts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  code text not null,
  name text not null,
  account_type text not null check (account_type in ('asset','liability','equity','revenue','expense')),
  normal_balance text not null check (normal_balance in ('debit','credit')),
  currency text not null default 'USD',
  is_system boolean not null default false,
  is_active boolean not null default true,
  parent_account_id uuid references public.chart_of_accounts(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(business_id,code)
);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  entry_no bigint generated always as identity,
  source_type text not null,
  source_id uuid,
  status text not null default 'draft' check (status in ('draft','posted','reversed')),
  memo text,
  occurred_at timestamptz not null default now(),
  posted_at timestamptz,
  created_by uuid references auth.users(id),
  reversal_of_id uuid references public.journal_entries(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references public.journal_entries(id) on delete restrict,
  business_id uuid not null references public.businesses(id) on delete cascade,
  account_id uuid not null references public.chart_of_accounts(id) on delete restrict,
  description text,
  debit numeric(20,6) not null default 0 check (debit >= 0),
  credit numeric(20,6) not null default 0 check (credit >= 0),
  currency text not null default 'USD',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check ((debit > 0 and credit = 0) or (credit > 0 and debit = 0))
);

alter table public.financial_transactions add column if not exists journal_entry_id uuid references public.journal_entries(id);
alter table public.invoice_payments add column if not exists journal_entry_id uuid references public.journal_entries(id);

create index if not exists chart_of_accounts_business_idx on public.chart_of_accounts(business_id);
create index if not exists journal_entries_business_occurred_idx on public.journal_entries(business_id,occurred_at desc);
create index if not exists journal_entries_source_idx on public.journal_entries(source_type,source_id);
create index if not exists journal_lines_entry_idx on public.journal_lines(journal_entry_id);
create index if not exists journal_lines_business_account_idx on public.journal_lines(business_id,account_id);
create index if not exists financial_transactions_journal_entry_idx on public.financial_transactions(journal_entry_id);
create index if not exists invoice_payments_journal_entry_idx on public.invoice_payments(journal_entry_id);

create or replace function private.prevent_posted_journal_mutation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if tg_op='DELETE' then
    if exists(select 1 from public.journal_entries je where je.id=old.journal_entry_id and je.status in ('posted','reversed')) then
      raise exception 'Posted or reversed journal lines are immutable';
    end if;
    return old;
  elsif tg_op='UPDATE' then
    if exists(select 1 from public.journal_entries je where je.id=old.journal_entry_id and je.status in ('posted','reversed')) then
      raise exception 'Posted or reversed journal lines are immutable';
    end if;
    return new;
  end if;
  return new;
end;
$$;

drop trigger if exists journal_lines_immutable on public.journal_lines;
create trigger journal_lines_immutable
before update or delete on public.journal_lines
for each row execute function private.prevent_posted_journal_mutation();

create or replace function private.prevent_posted_entry_mutation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if tg_op='DELETE' and old.status in ('posted','reversed') then
    raise exception 'Posted or reversed journal entries are immutable';
  end if;
  if tg_op='UPDATE' and old.status in ('posted','reversed') then
    raise exception 'Posted or reversed journal entries are immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists journal_entries_immutable on public.journal_entries;
create trigger journal_entries_immutable
before update or delete on public.journal_entries
for each row execute function private.prevent_posted_entry_mutation();

create or replace function public.post_journal_entry(p_journal_entry_id uuid)
returns public.journal_entries
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_entry public.journal_entries;
  v_debits numeric(20,6);
  v_credits numeric(20,6);
begin
  select * into v_entry from public.journal_entries where id=p_journal_entry_id for update;
  if not found then raise exception 'Journal entry not found'; end if;
  if v_entry.status <> 'draft' then raise exception 'Only draft journal entries can be posted'; end if;
  if not private.user_can_business(v_entry.business_id, ARRAY['owner','admin','manager','accountant']) then raise exception 'Not authorized to post journal entry'; end if;
  select coalesce(sum(debit),0), coalesce(sum(credit),0) into v_debits,v_credits from public.journal_lines where journal_entry_id=p_journal_entry_id;
  if v_debits <= 0 or v_debits <> v_credits then raise exception 'Journal entry must balance with positive debits and credits'; end if;
  update public.journal_entries set status='posted',posted_at=now(),updated_at=now() where id=p_journal_entry_id returning * into v_entry;
  return v_entry;
end;
$$;

grant execute on function public.post_journal_entry(uuid) to authenticated;

alter table public.chart_of_accounts enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines enable row level security;

drop policy if exists chart_of_accounts_member_select on public.chart_of_accounts;
drop policy if exists chart_of_accounts_manager_insert on public.chart_of_accounts;
drop policy if exists chart_of_accounts_manager_update on public.chart_of_accounts;
drop policy if exists chart_of_accounts_owner_delete on public.chart_of_accounts;
create policy chart_of_accounts_member_select on public.chart_of_accounts for select to authenticated using (private.user_can_business(business_id,null));
create policy chart_of_accounts_manager_insert on public.chart_of_accounts for insert to authenticated with check (private.user_can_business(business_id,ARRAY['owner','admin','manager','accountant']));
create policy chart_of_accounts_manager_update on public.chart_of_accounts for update to authenticated using (private.user_can_business(business_id,ARRAY['owner','admin','manager','accountant'])) with check (private.user_can_business(business_id,ARRAY['owner','admin','manager','accountant']));
create policy chart_of_accounts_owner_delete on public.chart_of_accounts for delete to authenticated using (private.user_can_business(business_id,ARRAY['owner','admin']));

drop policy if exists journal_entries_member_select on public.journal_entries;
drop policy if exists journal_entries_manager_insert on public.journal_entries;
drop policy if exists journal_entries_manager_update on public.journal_entries;
drop policy if exists journal_entries_owner_delete on public.journal_entries;
create policy journal_entries_member_select on public.journal_entries for select to authenticated using (private.user_can_business(business_id,null));
create policy journal_entries_manager_insert on public.journal_entries for insert to authenticated with check (private.user_can_business(business_id,ARRAY['owner','admin','manager','accountant']));
create policy journal_entries_manager_update on public.journal_entries for update to authenticated using (private.user_can_business(business_id,ARRAY['owner','admin','manager','accountant'])) with check (private.user_can_business(business_id,ARRAY['owner','admin','manager','accountant']));
create policy journal_entries_owner_delete on public.journal_entries for delete to authenticated using (private.user_can_business(business_id,ARRAY['owner','admin']));

drop policy if exists journal_lines_member_select on public.journal_lines;
drop policy if exists journal_lines_manager_insert on public.journal_lines;
drop policy if exists journal_lines_manager_update on public.journal_lines;
drop policy if exists journal_lines_owner_delete on public.journal_lines;
create policy journal_lines_member_select on public.journal_lines for select to authenticated using (private.user_can_business(business_id,null));
create policy journal_lines_manager_insert on public.journal_lines for insert to authenticated with check (private.user_can_business(business_id,ARRAY['owner','admin','manager','accountant']));
create policy journal_lines_manager_update on public.journal_lines for update to authenticated using (private.user_can_business(business_id,ARRAY['owner','admin','manager','accountant'])) with check (private.user_can_business(business_id,ARRAY['owner','admin','manager','accountant']));
create policy journal_lines_owner_delete on public.journal_lines for delete to authenticated using (private.user_can_business(business_id,ARRAY['owner','admin']));

create table if not exists public.ai_projects (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete set null,
  name text not null,
  slug text not null,
  project_type text not null default 'app',
  status text not null default 'active' check (status in ('active','archived','deleted')),
  default_branch text not null default 'main',
  framework text,
  runtime text,
  repository_integration_id uuid references public.integrations(id) on delete set null,
  repository_name text,
  preview_url text,
  production_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(business_id,slug)
);

create table if not exists public.ai_project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ai_projects(id) on delete cascade,
  path text not null,
  content text,
  content_sha text,
  language text,
  size_bytes bigint not null default 0,
  is_binary boolean not null default false,
  version_no integer not null default 1,
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id,path)
);

create table if not exists public.ai_project_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ai_projects(id) on delete cascade,
  version_no integer not null,
  message text,
  snapshot jsonb not null default '{}'::jsonb,
  source_run_id uuid references public.ai_build_runs(id) on delete set null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique(project_id,version_no)
);

create table if not exists public.ai_terminal_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ai_projects(id) on delete cascade,
  user_id uuid references auth.users(id),
  status text not null default 'open' check (status in ('open','running','completed','failed','closed')),
  working_directory text,
  command text,
  exit_code integer,
  output text,
  error_output text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_preview_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ai_projects(id) on delete cascade,
  version_id uuid references public.ai_project_versions(id) on delete set null,
  provider text not null default 'vercel',
  status text not null default 'created' check (status in ('created','building','ready','failed','stopped')),
  preview_url text,
  deployment_id text,
  build_output jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_project_events (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.ai_projects(id) on delete cascade,
  build_run_id uuid references public.ai_build_runs(id) on delete set null,
  event_type text not null,
  sequence_no integer not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(project_id,sequence_no)
);

alter table public.ai_build_runs add column if not exists project_id uuid references public.ai_projects(id) on delete set null;
alter table public.ai_build_steps add column if not exists project_id uuid references public.ai_projects(id) on delete set null;
alter table public.ai_build_artifacts add column if not exists project_id uuid references public.ai_projects(id) on delete set null;
alter table public.ai_build_tests add column if not exists project_id uuid references public.ai_projects(id) on delete set null;
alter table public.ai_build_approvals add column if not exists project_id uuid references public.ai_projects(id) on delete set null;

create index if not exists ai_projects_business_idx on public.ai_projects(business_id);
create index if not exists ai_project_files_project_idx on public.ai_project_files(project_id);
create index if not exists ai_project_versions_project_idx on public.ai_project_versions(project_id,version_no desc);
create index if not exists ai_terminal_sessions_project_idx on public.ai_terminal_sessions(project_id,created_at desc);
create index if not exists ai_preview_sessions_project_idx on public.ai_preview_sessions(project_id,created_at desc);
create index if not exists ai_project_events_project_seq_idx on public.ai_project_events(project_id,sequence_no);
create index if not exists ai_build_runs_project_idx on public.ai_build_runs(project_id);
create index if not exists ai_build_steps_project_idx on public.ai_build_steps(project_id);
create index if not exists ai_build_artifacts_project_idx on public.ai_build_artifacts(project_id);
create index if not exists ai_build_tests_project_idx on public.ai_build_tests(project_id);
create index if not exists ai_build_approvals_project_idx on public.ai_build_approvals(project_id);

alter table public.ai_projects enable row level security;
alter table public.ai_project_files enable row level security;
alter table public.ai_project_versions enable row level security;
alter table public.ai_terminal_sessions enable row level security;
alter table public.ai_preview_sessions enable row level security;
alter table public.ai_project_events enable row level security;

drop policy if exists ai_projects_member_select on public.ai_projects;
drop policy if exists ai_projects_manager_insert on public.ai_projects;
drop policy if exists ai_projects_manager_update on public.ai_projects;
drop policy if exists ai_projects_owner_delete on public.ai_projects;
create policy ai_projects_member_select on public.ai_projects for select to authenticated using (private.user_can_business(business_id,null));
create policy ai_projects_manager_insert on public.ai_projects for insert to authenticated with check (private.user_can_business(business_id,ARRAY['owner','admin','manager']));
create policy ai_projects_manager_update on public.ai_projects for update to authenticated using (private.user_can_business(business_id,ARRAY['owner','admin','manager'])) with check (private.user_can_business(business_id,ARRAY['owner','admin','manager']));
create policy ai_projects_owner_delete on public.ai_projects for delete to authenticated using (private.user_can_business(business_id,ARRAY['owner','admin']));

create policy ai_project_files_member_select on public.ai_project_files for select to authenticated
using (exists(select 1 from public.ai_projects p where p.id=ai_project_files.project_id and private.user_can_business(p.business_id,null)));
create policy ai_project_files_manager_insert on public.ai_project_files for insert to authenticated
with check (exists(select 1 from public.ai_projects p where p.id=ai_project_files.project_id and private.user_can_business(p.business_id,ARRAY['owner','admin','manager'])));
create policy ai_project_files_manager_update on public.ai_project_files for update to authenticated
using (exists(select 1 from public.ai_projects p where p.id=ai_project_files.project_id and private.user_can_business(p.business_id,ARRAY['owner','admin','manager'])))
with check (exists(select 1 from public.ai_projects p where p.id=ai_project_files.project_id and private.user_can_business(p.business_id,ARRAY['owner','admin','manager'])));
create policy ai_project_files_owner_delete on public.ai_project_files for delete to authenticated
using (exists(select 1 from public.ai_projects p where p.id=ai_project_files.project_id and private.user_can_business(p.business_id,ARRAY['owner','admin'])));

create policy ai_project_versions_member_select on public.ai_project_versions for select to authenticated
using (exists(select 1 from public.ai_projects p where p.id=ai_project_versions.project_id and private.user_can_business(p.business_id,null)));
create policy ai_project_versions_manager_insert on public.ai_project_versions for insert to authenticated
with check (exists(select 1 from public.ai_projects p where p.id=ai_project_versions.project_id and private.user_can_business(p.business_id,ARRAY['owner','admin','manager'])));

create policy ai_terminal_sessions_manager_all on public.ai_terminal_sessions for all to authenticated
using (exists(select 1 from public.ai_projects p where p.id=ai_preview_sessions.project_id and private.user_can_business(p.business_id,ARRAY['owner','admin','manager'])))
with check (exists(select 1 from public.ai_projects p where p.id=ai_terminal_sessions.project_id and private.user_can_business(p.business_id,ARRAY['owner','admin','manager'])));

create policy ai_preview_sessions_manager_all on public.ai_preview_sessions for all to authenticated
using (exists(select 1 from public.ai_projects p where p.id=ai_preview_sessions.project_id and private.user_can_business(p.business_id,ARRAY['owner','admin','manager'])))
with check (exists(select 1 from public.ai_projects p where p.id=ai_terminal_sessions.project_id and private.user_can_business(p.business_id,ARRAY['owner','admin','manager'])));

create policy ai_project_events_member_select on public.ai_project_events for select to authenticated
using (exists(select 1 from public.ai_projects p where p.id=ai_project_events.project_id and private.user_can_business(p.business_id,null)));