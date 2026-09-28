create table if not exists public.customer_portal_access_requests (
  id uuid primary key default gen_random_uuid(),
  portal_id uuid not null references public.customer_portals(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.customer_portal_sessions (
  id uuid primary key default gen_random_uuid(),
  portal_id uuid not null references public.customer_portals(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  session_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.customer_portal_events (
  id bigint generated always as identity primary key,
  portal_id uuid not null references public.customer_portals(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists customer_portals_business_slug_idx
  on public.customer_portals(business_id, lower(slug))
  where slug is not null;

create index if not exists customer_portal_access_requests_lookup_idx
  on public.customer_portal_access_requests(token_hash, expires_at)
  where consumed_at is null;

create index if not exists customer_portal_sessions_lookup_idx
  on public.customer_portal_sessions(session_hash, expires_at)
  where revoked_at is null;

create index if not exists customer_portal_events_portal_created_idx
  on public.customer_portal_events(portal_id, created_at desc);

alter table public.customer_portal_access_requests enable row level security;
alter table public.customer_portal_sessions enable row level security;
alter table public.customer_portal_events enable row level security;

drop policy if exists customer_portal_access_owner on public.customer_portal_access_requests;
create policy customer_portal_access_owner on public.customer_portal_access_requests
for all to authenticated
using (exists(select 1 from public.customer_portals p join public.businesses b on b.id=p.business_id where p.id=customer_portal_access_requests.portal_id and b.owner_id=(select auth.uid())))
with check (exists(select 1 from public.customer_portals p join public.businesses b on b.id=p.business_id where p.id=customer_portal_access_requests.portal_id and b.owner_id=(select auth.uid())));

drop policy if exists customer_portal_sessions_owner on public.customer_portal_sessions;
create policy customer_portal_sessions_owner on public.customer_portal_sessions
for all to authenticated
using (exists(select 1 from public.customer_portals p join public.businesses b on b.id=p.business_id where p.id=customer_portal_sessions.portal_id and b.owner_id=(select auth.uid())))
with check (exists(select 1 from public.customer_portals p join public.businesses b on b.id=p.business_id where p.id=customer_portal_sessions.portal_id and b.owner_id=(select auth.uid())));

drop policy if exists customer_portal_events_owner on public.customer_portal_events;
create policy customer_portal_events_owner on public.customer_portal_events
for all to authenticated
using (exists(select 1 from public.customer_portals p join public.businesses b on b.id=p.business_id where p.id=customer_portal_events.portal_id and b.owner_id=(select auth.uid())))
with check (exists(select 1 from public.customer_portals p join public.businesses b on b.id=p.business_id where p.id=customer_portal_events.portal_id and b.owner_id=(select auth.uid())));

grant select,insert,update,delete on public.customer_portal_access_requests to authenticated;
grant select,insert,update,delete on public.customer_portal_sessions to authenticated;
grant select,insert,update,delete on public.customer_portal_events to authenticated;
grant usage,select on sequence public.customer_portal_events_id_seq to authenticated;

alter table public.customer_portals enable row level security;
drop policy if exists customer_portals_owner_all on public.customer_portals;
create policy customer_portals_owner_all on public.customer_portals
for all to authenticated
using (exists(select 1 from public.businesses b where b.id=customer_portals.business_id and b.owner_id=(select auth.uid())))
with check (exists(select 1 from public.businesses b where b.id=customer_portals.business_id and b.owner_id=(select auth.uid())));

grant select,insert,update,delete on public.customer_portals to authenticated;
