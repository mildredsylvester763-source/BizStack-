-- Website write-action controls are intentionally separate from public read bindings.
-- They gate customer-facing website -> business mutations and provide idempotency/rate-limit state.

create table if not exists public.website_action_bindings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  website_id uuid not null references public.websites(id) on delete cascade,
  action_key text not null check (action_key in (
    'booking_request','order_request','lead_capture','quote_request',
    'support_request','payment_request','communication_request'
  )),
  enabled boolean not null default false,
  auth_mode text not null default 'public' check (auth_mode in ('public','customer','authenticated')),
  rate_limit_per_minute integer not null default 30 check (rate_limit_per_minute between 1 and 1000),
  require_idempotency boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (website_id, action_key)
);

create table if not exists public.website_action_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  website_id uuid not null references public.websites(id) on delete cascade,
  action_key text not null,
  idempotency_key text,
  request_fingerprint text,
  source_ip text,
  status text not null default 'processing' check (status in ('processing','succeeded','failed','rejected')),
  response jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists website_action_requests_idempotency_uq
  on public.website_action_requests(website_id, action_key, idempotency_key)
  where idempotency_key is not null;

create index if not exists website_action_bindings_business_idx
  on public.website_action_bindings(business_id);
create index if not exists website_action_requests_rate_idx
  on public.website_action_requests(website_id, action_key, source_ip, created_at desc);
create index if not exists website_action_requests_business_idx
  on public.website_action_requests(business_id, created_at desc);

alter table public.website_action_bindings enable row level security;
alter table public.website_action_requests enable row level security;

drop policy if exists "website action bindings owner access" on public.website_action_bindings;
create policy "website action bindings owner access"
on public.website_action_bindings
for all to authenticated
using (
  exists (
    select 1 from public.businesses b
    where b.id = website_action_bindings.business_id
      and b.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.businesses b
    where b.id = website_action_bindings.business_id
      and b.owner_id = (select auth.uid())
  )
);

drop policy if exists "website action requests owner read" on public.website_action_requests;
create policy "website action requests owner read"
on public.website_action_requests
for select to authenticated
using (
  exists (
    select 1 from public.businesses b
    where b.id = website_action_requests.business_id
      and b.owner_id = (select auth.uid())
  )
);
