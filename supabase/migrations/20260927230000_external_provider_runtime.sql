create table if not exists public.integration_credentials (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  integration_id uuid not null unique references public.integrations(id) on delete cascade,
  credential_kind text not null check (credential_kind in ('api_key','oauth','bearer','basic','database','webhook','custom')),
  encrypted_payload text not null,
  key_version text not null default 'v1',
  status text not null default 'active' check (status in ('active','expired','revoked','invalid')),
  expires_at timestamptz, last_verified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.integration_resources (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  integration_id uuid not null references public.integrations(id) on delete cascade,
  resource_type text not null, external_id text not null, local_entity_type text, local_entity_id uuid,
  external_payload jsonb not null default '{}'::jsonb, content_hash text,
  external_created_at timestamptz, external_updated_at timestamptz,
  sync_status text not null default 'synced' check (sync_status in ('synced','pending','conflict','error','ignored','deleted')),
  last_synced_at timestamptz not null default now(), metadata jsonb not null default '{}'::jsonb,
  unique (integration_id, resource_type, external_id)
);
create table if not exists public.business_events_outbox (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  event_type text not null, aggregate_type text, aggregate_id uuid, payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','processing','published','failed','dead_letter')),
  attempts integer not null default 0, max_attempts integer not null default 10, next_attempt_at timestamptz not null default now(),
  idempotency_key text, last_error text, published_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (business_id, idempotency_key)
);
alter table public.communication_delivery_jobs
  add column if not exists provider_config jsonb not null default '{}'::jsonb,
  add column if not exists provider_status text,
  add column if not exists response_metadata jsonb not null default '{}'::jsonb;
create index if not exists integration_credentials_business_idx on public.integration_credentials(business_id);
create index if not exists integration_resources_business_idx on public.integration_resources(business_id, resource_type, last_synced_at desc);
create index if not exists business_events_outbox_queue_idx on public.business_events_outbox(status, next_attempt_at);
create index if not exists communication_delivery_jobs_queue_idx on public.communication_delivery_jobs(status, next_attempt_at);
alter table public.integration_credentials enable row level security;
alter table public.integration_resources enable row level security;
alter table public.business_events_outbox enable row level security;
grant select, insert, update, delete on public.integration_credentials, public.integration_resources, public.business_events_outbox to authenticated;
do $$
declare t text;
begin
  foreach t in array array['integration_credentials','integration_resources','business_events_outbox'] loop
    execute format('drop policy if exists "Business owners select %s" on public.%I', t, t);
    execute format('create policy "Business owners select %s" on public.%I for select to authenticated using (exists (select 1 from public.businesses where businesses.id = %I.business_id and businesses.owner_id = auth.uid()))', t, t, t);
    execute format('drop policy if exists "Business owners insert %s" on public.%I', t, t);
    execute format('create policy "Business owners insert %s" on public.%I for insert to authenticated with check (exists (select 1 from public.businesses where businesses.id = %I.business_id and businesses.owner_id = auth.uid()))', t, t, t);
    execute format('drop policy if exists "Business owners update %s" on public.%I', t, t);
    execute format('create policy "Business owners update %s" on public.%I for update to authenticated using (exists (select 1 from public.businesses where businesses.id = %I.business_id and businesses.owner_id = auth.uid())) with check (exists (select 1 from public.businesses where businesses.id = %I.business_id and businesses.owner_id = auth.uid()))', t, t, t, t);
    execute format('drop policy if exists "Business owners delete %s" on public.%I', t, t);
    execute format('create policy "Business owners delete %s" on public.%I for delete to authenticated using (exists (select 1 from public.businesses where businesses.id = %I.business_id and businesses.owner_id = auth.uid()))', t, t, t);
  end loop;
end $$;

create or replace function public.claim_communication_delivery_jobs(p_limit integer default 10)
returns setof public.communication_delivery_jobs
language plpgsql security definer set search_path=public
as $$
begin
  return query
  with picked as (
    select id from public.communication_delivery_jobs
    where status='queued' and next_attempt_at <= now() and attempts < max_attempts
    order by next_attempt_at asc, created_at asc
    for update skip locked limit greatest(1,least(p_limit,50))
  )
  update public.communication_delivery_jobs j
  set status='processing', attempts=j.attempts+1, updated_at=now()
  from picked where j.id=picked.id returning j.*;
end $$;
revoke execute on function public.claim_communication_delivery_jobs(integer) from public, anon, authenticated;
grant execute on function public.claim_communication_delivery_jobs(integer) to service_role;
