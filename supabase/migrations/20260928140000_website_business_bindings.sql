-- Website <-> Business live integration bindings and marketplace-ready extension taxonomy.
create table if not exists public.website_business_bindings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  website_id uuid not null references public.websites(id) on delete cascade,
  source_key text not null check (source_key in (
    'business_profile','products','inventory_availability','services',
    'public_offers','locations','opening_hours','bookings','public_reviews'
  )),
  enabled boolean not null default true,
  exposure text not null default 'public' check (exposure in ('public','customer','private')),
  fields jsonb not null default '[]'::jsonb,
  sync_mode text not null default 'near_realtime' check (sync_mode in ('near_realtime','cached','webhook','manual')),
  refresh_seconds integer,
  config jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (website_id, source_key)
);

create index if not exists website_business_bindings_business_idx
  on public.website_business_bindings(business_id, enabled);
create index if not exists website_business_bindings_website_idx
  on public.website_business_bindings(website_id, enabled);

alter table public.website_business_bindings enable row level security;

drop policy if exists website_business_bindings_owner_all on public.website_business_bindings;
create policy website_business_bindings_owner_all
on public.website_business_bindings
for all to authenticated
using (exists (
  select 1 from public.businesses b
  where b.id=website_business_bindings.business_id and b.owner_id=auth.uid()
))
with check (exists (
  select 1 from public.businesses b
  where b.id=website_business_bindings.business_id and b.owner_id=auth.uid()
));

-- Keep marketplace listings broad enough to support business resources and software extensions.
create index if not exists marketplace_listings_type_status_idx
  on public.marketplace_listings(listing_type,status);
