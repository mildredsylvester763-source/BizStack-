create extension if not exists pgcrypto;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  event_type text not null,
  summary text not null,
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'info' check (status in ('info', 'needs_approval', 'auto_handled', 'dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists events_business_created_at_idx
  on public.events (business_id, created_at desc);

create table if not exists public.automation_settings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  action_type text not null,
  mode text not null default 'ask_first' check (mode in ('draft_only', 'ask_first', 'auto_execute')),
  limit_value numeric,
  unique (business_id, action_type)
);

alter table public.events enable row level security;
alter table public.automation_settings enable row level security;

drop policy if exists "Business owners can select events" on public.events;
drop policy if exists "Business owners can insert events" on public.events;
drop policy if exists "Business owners can update events" on public.events;

create policy "Business owners can select events"
  on public.events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.businesses
      where businesses.id = events.business_id
        and businesses.owner_id = auth.uid()
    )
  );

create policy "Business owners can insert events"
  on public.events
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.businesses
      where businesses.id = events.business_id
        and businesses.owner_id = auth.uid()
    )
  );

create policy "Business owners can update events"
  on public.events
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.businesses
      where businesses.id = events.business_id
        and businesses.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.businesses
      where businesses.id = events.business_id
        and businesses.owner_id = auth.uid()
    )
  );

drop policy if exists "Business owners can select automation settings" on public.automation_settings;
drop policy if exists "Business owners can insert automation settings" on public.automation_settings;
drop policy if exists "Business owners can update automation settings" on public.automation_settings;

create policy "Business owners can select automation settings"
  on public.automation_settings
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.businesses
      where businesses.id = automation_settings.business_id
        and businesses.owner_id = auth.uid()
    )
  );

create policy "Business owners can insert automation settings"
  on public.automation_settings
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.businesses
      where businesses.id = automation_settings.business_id
        and businesses.owner_id = auth.uid()
    )
  );

create policy "Business owners can update automation settings"
  on public.automation_settings
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.businesses
      where businesses.id = automation_settings.business_id
        and businesses.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.businesses
      where businesses.id = automation_settings.business_id
        and businesses.owner_id = auth.uid()
    )
  );
