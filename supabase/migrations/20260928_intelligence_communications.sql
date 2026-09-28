-- Provider-ready communications, consent, carbon activity and fractional CFO snapshots.
create table if not exists public.communication_consents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  channel text not null check(channel in ('sms','whatsapp','email','voice')),
  consent_status text not null default 'unknown' check(consent_status in ('unknown','opted_in','opted_out')),
  source text not null default 'manual',
  captured_at timestamptz not null default now(),
  expires_at timestamptz,
  proof jsonb not null default '{}'::jsonb,
  unique(business_id,customer_id,channel)
);
create table if not exists public.broadcast_campaigns (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  channel text not null check(channel in ('sms','whatsapp','email')),
  message_template text not null,
  status text not null default 'draft' check(status in ('draft','review','approved','queued','sending','completed','cancelled')),
  audience_filter jsonb not null default '{}'::jsonb,
  opt_out_policy text not null default 'strict' check(opt_out_policy in ('strict','allow_if_unknown')),
  provider_required boolean not null default true,
  scheduled_at timestamptz,
  sent_count integer not null default 0,
  blocked_count integer not null default 0,
  failed_count integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.broadcast_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.broadcast_campaigns(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  recipient text not null,
  status text not null default 'pending' check(status in ('pending','blocked','queued','sent','failed')),
  block_reason text,
  provider_message_id text,
  sent_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);
create index if not exists broadcast_recipients_campaign_idx on public.broadcast_recipients(campaign_id,status);
create table if not exists public.voice_agents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  greeting text,
  system_instructions text,
  phone_number text,
  provider text,
  provider_agent_id text,
  status text not null default 'draft' check(status in ('draft','active','paused')),
  tools jsonb not null default '[]'::jsonb,
  business_hours jsonb not null default '{}'::jsonb,
  escalation_policy jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.voice_calls (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  voice_agent_id uuid references public.voice_agents(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  direction text not null check(direction in ('inbound','outbound')),
  provider_call_id text,
  from_number text,
  to_number text,
  status text not null default 'queued' check(status in ('queued','ringing','in_progress','completed','failed','transferred')),
  started_at timestamptz,
  ended_at timestamptz,
  transcript text,
  summary text,
  actions_taken jsonb not null default '[]'::jsonb,
  recording_ref text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.carbon_activity_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  activity_type text not null check(activity_type in ('electricity','generator_fuel','vehicle_fuel','delivery','air_travel','waste','refrigeration','water','other')),
  quantity numeric(20,6) not null check(quantity >= 0),
  unit text not null,
  emission_factor numeric(20,8) not null default 0,
  co2e_kg numeric(20,6) generated always as (round(quantity*emission_factor,6)) stored,
  activity_date date not null default current_date,
  source text not null default 'manual',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists carbon_activity_business_date_idx on public.carbon_activity_entries(business_id,activity_date desc);
create table if not exists public.cfo_snapshots (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  currency text not null,
  revenue numeric(20,6) not null default 0,
  expenses numeric(20,6) not null default 0,
  net_cashflow numeric(20,6) not null default 0,
  receivables numeric(20,6) not null default 0,
  payables numeric(20,6) not null default 0,
  overdue_receivables numeric(20,6) not null default 0,
  runway_months numeric(20,6),
  recommendations jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  assumptions jsonb not null default '[]'::jsonb,
  generated_by text not null default 'deterministic_finance_engine',
  created_at timestamptz not null default now()
);
create index if not exists cfo_snapshots_business_period_idx on public.cfo_snapshots(business_id,period_end desc);
alter table public.communication_consents enable row level security;
alter table public.broadcast_campaigns enable row level security;
alter table public.broadcast_recipients enable row level security;
alter table public.voice_agents enable row level security;
alter table public.voice_calls enable row level security;
alter table public.carbon_activity_entries enable row level security;
alter table public.cfo_snapshots enable row level security;
create policy communication_consents_owner_all on public.communication_consents for all to authenticated using(exists(select 1 from public.businesses b where b.id=communication_consents.business_id and b.owner_id=(select auth.uid()))) with check(exists(select 1 from public.businesses b where b.id=communication_consents.business_id and b.owner_id=(select auth.uid())));
create policy broadcast_campaigns_owner_all on public.broadcast_campaigns for all to authenticated using(exists(select 1 from public.businesses b where b.id=broadcast_campaigns.business_id and b.owner_id=(select auth.uid()))) with check(exists(select 1 from public.businesses b where b.id=broadcast_campaigns.business_id and b.owner_id=(select auth.uid())));
create policy broadcast_recipients_owner_all on public.broadcast_recipients for all to authenticated using(exists(select 1 from public.broadcast_campaigns c join public.businesses b on b.id=c.business_id where c.id=broadcast_recipients.campaign_id and b.owner_id=(select auth.uid()))) with check(exists(select 1 from public.broadcast_campaigns c join public.businesses b on b.id=c.business_id where c.id=broadcast_recipients.campaign_id and b.owner_id=(select auth.uid())));
create policy voice_agents_owner_all on public.voice_agents for all to authenticated using(exists(select 1 from public.businesses b where b.id=voice_agents.business_id and b.owner_id=(select auth.uid()))) with check(exists(select 1 from public.businesses b where b.id=voice_agents.business_id and b.owner_id=(select auth.uid())));
create policy voice_calls_owner_all on public.voice_calls for all to authenticated using(exists(select 1 from public.businesses b where b.id=voice_calls.business_id and b.owner_id=(select auth.uid()))) with check(exists(select 1 from public.businesses b where b.id=voice_calls.business_id and b.owner_id=(select auth.uid())));
create policy carbon_activity_owner_all on public.carbon_activity_entries for all to authenticated using(exists(select 1 from public.businesses b where b.id=carbon_activity_entries.business_id and b.owner_id=(select auth.uid()))) with check(exists(select 1 from public.businesses b where b.id=carbon_activity_entries.business_id and b.owner_id=(select auth.uid())));
create policy cfo_snapshots_owner_all on public.cfo_snapshots for all to authenticated using(exists(select 1 from public.businesses b where b.id=cfo_snapshots.business_id and b.owner_id=(select auth.uid()))) with check(exists(select 1 from public.businesses b where b.id=cfo_snapshots.business_id and b.owner_id=(select auth.uid())));