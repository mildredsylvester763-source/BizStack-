-- Product media studio, B2B marketplace and external finance API clients.
create table if not exists public.product_media_assets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  asset_type text not null default 'product_photo' check(asset_type in ('product_photo','lifestyle','background_removal','variant','social_crop')),
  prompt text not null,
  style text,
  provider text,
  provider_job_id text,
  status text not null default 'draft' check(status in ('draft','queued','processing','completed','failed','rejected')),
  source_image_ref text,
  output_ref text,
  metadata jsonb not null default '{}'::jsonb,
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists product_media_assets_product_idx on public.product_media_assets(product_id,created_at desc);

create table if not exists public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  seller_business_id uuid not null references public.businesses(id) on delete cascade,
  category text not null default 'general',
  title text not null,
  description text,
  listing_type text not null default 'service' check(listing_type in ('product','service','wholesale','partnership','procurement')),
  price numeric(20,6),
  currency text,
  quantity_available numeric(20,6),
  location_country text,
  location_region text,
  status text not null default 'draft' check(status in ('draft','published','paused','sold_out','archived')),
  tags text[] not null default '{}',
  requirements jsonb not null default '{}'::jsonb,
  contact_policy text not null default 'platform_inquiry' check(contact_policy in ('platform_inquiry','direct','invite_only')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists marketplace_listings_search_idx on public.marketplace_listings(status,category,listing_type,created_at desc);
create index if not exists marketplace_listings_seller_idx on public.marketplace_listings(seller_business_id,status);

create table if not exists public.marketplace_inquiries (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  buyer_business_id uuid not null references public.businesses(id) on delete cascade,
  message text not null,
  requested_quantity numeric(20,6),
  offer_amount numeric(20,6),
  currency text,
  status text not null default 'open' check(status in ('open','responded','accepted','rejected','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists marketplace_inquiries_listing_idx on public.marketplace_inquiries(listing_id,status,created_at desc);
create index if not exists marketplace_inquiries_buyer_idx on public.marketplace_inquiries(buyer_business_id,status,created_at desc);

create table if not exists public.finance_api_clients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_name text not null,
  client_type text not null default 'external_app' check(client_type in ('external_app','school','church','cooperative','accountant','partner')),
  status text not null default 'active' check(status in ('active','suspended','revoked')),
  scopes text[] not null default '{}',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.finance_api_keys (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.finance_api_clients(id) on delete cascade,
  key_prefix text not null,
  key_hash text not null unique,
  scopes text[] not null default '{}',
  status text not null default 'active' check(status in ('active','revoked')),
  last_used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists finance_api_keys_client_idx on public.finance_api_keys(client_id,status);

alter table public.product_media_assets enable row level security;
alter table public.marketplace_listings enable row level security;
alter table public.marketplace_inquiries enable row level security;
alter table public.finance_api_clients enable row level security;
alter table public.finance_api_keys enable row level security;

drop policy if exists product_media_owner_all on public.product_media_assets;
create policy product_media_owner_all on public.product_media_assets for all to authenticated using(exists(select 1 from public.businesses b where b.id=product_media_assets.business_id and b.owner_id=(select auth.uid()))) with check(exists(select 1 from public.businesses b where b.id=product_media_assets.business_id and b.owner_id=(select auth.uid())));

drop policy if exists marketplace_listing_owner_all on public.marketplace_listings;
create policy marketplace_listing_owner_all on public.marketplace_listings for all to authenticated using(exists(select 1 from public.businesses b where b.id=marketplace_listings.seller_business_id and b.owner_id=(select auth.uid()))) with check(exists(select 1 from public.businesses b where b.id=marketplace_listings.seller_business_id and b.owner_id=(select auth.uid())));

drop policy if exists marketplace_inquiry_participant_all on public.marketplace_inquiries;
create policy marketplace_inquiry_participant_all on public.marketplace_inquiries for all to authenticated
using(exists(select 1 from public.marketplace_listings l where l.id=marketplace_inquiries.listing_id and (
  exists(select 1 from public.businesses b where b.id=l.seller_business_id and b.owner_id=(select auth.uid()))
  or exists(select 1 from public.businesses b where b.id=marketplace_inquiries.buyer_business_id and b.owner_id=(select auth.uid()))
)))
with check(exists(select 1 from public.businesses b where b.id=marketplace_inquiries.buyer_business_id and b.owner_id=(select auth.uid())));

drop policy if exists finance_api_clients_owner_all on public.finance_api_clients;
create policy finance_api_clients_owner_all on public.finance_api_clients for all to authenticated using(exists(select 1 from public.businesses b where b.id=finance_api_clients.business_id and b.owner_id=(select auth.uid()))) with check(exists(select 1 from public.businesses b where b.id=finance_api_clients.business_id and b.owner_id=(select auth.uid())));

drop policy if exists finance_api_keys_owner_all on public.finance_api_keys;
create policy finance_api_keys_owner_all on public.finance_api_keys for all to authenticated using(exists(select 1 from public.finance_api_clients c join public.businesses b on b.id=c.business_id where c.id=finance_api_keys.client_id and b.owner_id=(select auth.uid()))) with check(exists(select 1 from public.finance_api_clients c join public.businesses b on b.id=c.business_id where c.id=finance_api_keys.client_id and b.owner_id=(select auth.uid())));
