-- Agent execution runtime layer
-- Applied to the production Supabase database on 2026-09-27.

create table if not exists public.ai_tools (
  id uuid primary key default gen_random_uuid(),
  tool_key text not null unique,
  name text not null,
  description text not null,
  category text not null default 'business',
  risk_level text not null default 'low' check (risk_level in ('low','medium','high','critical')),
  input_schema jsonb not null default '{}'::jsonb,
  output_schema jsonb not null default '{}'::jsonb,
  capabilities jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('active','disabled')),
  created_at timestamptz not null default now()
);

create table if not exists public.ai_agent_tool_bindings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  agent_id uuid not null references public.ai_agents(id) on delete cascade,
  tool_id uuid not null references public.ai_tools(id) on delete cascade,
  enabled boolean not null default true,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (agent_id, tool_id)
);

create table if not exists public.ai_agent_run_steps (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  agent_run_id uuid not null references public.ai_agent_runs(id) on delete cascade,
  sequence_no integer not null,
  step_type text not null check (step_type in ('plan','tool_call','approval','finalize')),
  tool_key text,
  status text not null default 'queued' check (status in ('queued','running','waiting_approval','succeeded','skipped','failed','cancelled')),
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error_message text,
  requires_approval boolean not null default false,
  approval_id uuid references public.ai_agent_approvals(id) on delete set null,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  unique (agent_run_id, sequence_no)
);

create table if not exists public.connector_sync_state (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  connector_definition_id uuid not null references public.connector_definitions(id) on delete cascade,
  resource text not null,
  cursor_value text,
  last_synced_at timestamptz,
  status text not null default 'idle' check (status in ('idle','running','succeeded','failed')),
  records_synced integer not null default 0,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (connector_definition_id, resource)
);

create index if not exists ai_agent_tool_bindings_business_idx on public.ai_agent_tool_bindings(business_id);
create index if not exists ai_agent_tool_bindings_agent_idx on public.ai_agent_tool_bindings(agent_id);
create index if not exists ai_agent_tool_bindings_tool_idx on public.ai_agent_tool_bindings(tool_id);
create index if not exists ai_agent_run_steps_business_idx on public.ai_agent_run_steps(business_id);
create index if not exists ai_agent_run_steps_run_idx on public.ai_agent_run_steps(agent_run_id);
create index if not exists ai_agent_run_steps_status_idx on public.ai_agent_run_steps(status);
create index if not exists connector_sync_state_business_idx on public.connector_sync_state(business_id);
create index if not exists connector_sync_state_connector_idx on public.connector_sync_state(connector_definition_id);

alter table public.ai_tools enable row level security;
alter table public.ai_agent_tool_bindings enable row level security;
alter table public.ai_agent_run_steps enable row level security;
alter table public.connector_sync_state enable row level security;

drop policy if exists ai_tools_authenticated_read on public.ai_tools;
create policy ai_tools_authenticated_read
on public.ai_tools for select to authenticated using (status = 'active');

drop policy if exists ai_agent_tool_bindings_owner_all on public.ai_agent_tool_bindings;
create policy ai_agent_tool_bindings_owner_all
on public.ai_agent_tool_bindings for all to authenticated
using (exists (select 1 from public.businesses b where b.id = ai_agent_tool_bindings.business_id and b.owner_id = (select auth.uid())))
with check (exists (select 1 from public.businesses b where b.id = ai_agent_tool_bindings.business_id and b.owner_id = (select auth.uid())));

drop policy if exists ai_agent_run_steps_owner_all on public.ai_agent_run_steps;
create policy ai_agent_run_steps_owner_all
on public.ai_agent_run_steps for all to authenticated
using (exists (select 1 from public.businesses b where b.id = ai_agent_run_steps.business_id and b.owner_id = (select auth.uid())))
with check (exists (select 1 from public.businesses b where b.id = ai_agent_run_steps.business_id and b.owner_id = (select auth.uid())));

drop policy if exists connector_sync_state_owner_all on public.connector_sync_state;
create policy connector_sync_state_owner_all
on public.connector_sync_state for all to authenticated
using (exists (select 1 from public.businesses b where b.id = connector_sync_state.business_id and b.owner_id = (select auth.uid())))
with check (exists (select 1 from public.businesses b where b.id = connector_sync_state.business_id and b.owner_id = (select auth.uid())));

insert into public.ai_tools (tool_key,name,description,category,risk_level,input_schema,output_schema,capabilities)
values
('business.get_context','Business Context','Read the business profile and operating settings.','business','low','{"type":"object"}','{"type":"object"}','["read"]'),
('customers.list','Customer Directory','Read customers for segmentation, service and follow-up decisions.','crm','low','{"type":"object","properties":{"limit":{"type":"integer"}}}','{"type":"array"}','["read"]'),
('invoices.list_outstanding','Outstanding Invoices','Read open invoices, amounts and due dates.','money','low','{"type":"object"}','{"type":"array"}','["read","receivables"]'),
('inventory.list_low_stock','Low Stock Watch','Read products below their configured stock threshold.','inventory','low','{"type":"object"}','{"type":"array"}','["read","inventory"]'),
('money.summary','Money Summary','Read receivables and recent financial activity for planning.','money','low','{"type":"object"}','{"type":"object"}','["read","finance"]'),
('events.create','Create Business Event','Record an auditable internal action, recommendation or handoff in the business timeline.','operations','low','{"type":"object","required":["event_type","summary"]}','{"type":"object"}','["write","audit"]')
on conflict (tool_key) do update set
  name=excluded.name, description=excluded.description, category=excluded.category,
  risk_level=excluded.risk_level, input_schema=excluded.input_schema,
  output_schema=excluded.output_schema, capabilities=excluded.capabilities, status='active';
