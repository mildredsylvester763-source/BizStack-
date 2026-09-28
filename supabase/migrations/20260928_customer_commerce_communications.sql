-- SMS credit wallet, appointments/deposits, QR menus/kitchen flow and waivers.
create table if not exists public.sms_credit_wallets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  currency text not null default 'USD',
  balance_credits numeric(20,6) not null default 0 check(balance_credits >= 0),
  reserved_credits numeric(20,6) not null default 0 check(reserved_credits >= 0),
  low_balance_threshold numeric(20,6) not null default 100,
  status text not null default 'active' check(status = any(array['active','locked','disabled'])),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(business_id)
);

create table if not exists public.sms_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  wallet_id uuid not null references public.sms_credit_wallets(id) on delete cascade,
  direction text not null check(direction in ('credit','debit','reserve','release')),
  credits numeric(20,6) not null check(credits > 0),
  reference_type text,
  reference_id uuid,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists sms_credit_ledger_business_idx on public.sms_credit_ledger(business_id,created_at desc);

create table if not exists public.appointment_services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  description text,
  duration_minutes integer not null default 30 check(duration_minutes > 0),
  price numeric(20,6) not null default 0 check(price >= 0),
  currency text not null,
  deposit_type text not null default 'none' check(deposit_type in ('none','fixed','percentage')),
  deposit_value numeric(20,6) not null default 0 check(deposit_value >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists appointment_services_business_idx on public.appointment_services(business_id,active);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  service_id uuid references public.appointment_services(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'pending' check(status = any(array['pending','confirmed','checked_in','completed','cancelled','no_show'])),
  price numeric(20,6) not null default 0,
  deposit_required numeric(20,6) not null default 0,
  deposit_paid numeric(20,6) not null default 0,
  currency text not null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(ends_at > starts_at),
  check(deposit_paid <= deposit_required)
);
create index if not exists appointments_business_start_idx on public.appointments(business_id,starts_at,status);
create index if not exists appointments_customer_idx on public.appointments(business_id,customer_id,starts_at desc);

create table if not exists public.digital_menus (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  slug text not null,
  status text not null default 'draft' check(status in ('draft','published','archived')),
  qr_token text unique default encode(gen_random_bytes(18),'hex'),
  currency text not null,
  kitchen_flow_enabled boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(business_id,slug)
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references public.digital_menus(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name text not null,
  description text,
  price numeric(20,6) not null default 0 check(price >= 0),
  category text,
  image_path text,
  available boolean not null default true,
  preparation_minutes integer not null default 0 check(preparation_minutes >= 0),
  sort_order integer not null default 0,
  options jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists menu_items_menu_idx on public.menu_items(menu_id,sort_order);

create table if not exists public.kitchen_orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  menu_id uuid references public.digital_menus(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  order_number text not null,
  status text not null default 'queued' check(status in ('queued','accepted','preparing','ready','served','cancelled')),
  payment_status text not null default 'unpaid' check(payment_status in ('unpaid','deposit','paid','refunded')),
  total numeric(20,6) not null default 0,
  currency text not null,
  table_label text,
  items jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(business_id,order_number)
);
create index if not exists kitchen_orders_flow_idx on public.kitchen_orders(business_id,status,created_at);

create table if not exists public.waivers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  title text not null,
  body text not null,
  version integer not null default 1,
  status text not null default 'draft' check(status in ('draft','published','archived')),
  required boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.waiver_signatures (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  waiver_id uuid not null references public.waivers(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  signer_name text not null,
  signer_email text,
  signature_type text not null default 'typed' check(signature_type in ('typed','drawn','external')),
  signature_value text not null,
  signed_at timestamptz not null default now(),
  ip_hash text,
  user_agent_hash text,
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists waiver_signatures_business_idx on public.waiver_signatures(business_id,waiver_id,signed_at desc);

alter table public.sms_credit_wallets enable row level security;
alter table public.sms_credit_ledger enable row level security;
alter table public.appointment_services enable row level security;
alter table public.appointments enable row level security;
alter table public.digital_menus enable row level security;
alter table public.menu_items enable row level security;
alter table public.kitchen_orders enable row level security;
alter table public.waivers enable row level security;
alter table public.waiver_signatures enable row level security;

drop policy if exists sms_credit_wallets_owner_all on public.sms_credit_wallets;
create policy sms_credit_wallets_owner_all on public.sms_credit_wallets for all to authenticated using(exists(select 1 from public.businesses b where b.id=sms_credit_wallets.business_id and b.owner_id=(select auth.uid()))) with check(exists(select 1 from public.businesses b where b.id=sms_credit_wallets.business_id and b.owner_id=(select auth.uid())));
drop policy if exists sms_credit_ledger_owner_all on public.sms_credit_ledger;
create policy sms_credit_ledger_owner_all on public.sms_credit_ledger for all to authenticated using(exists(select 1 from public.businesses b where b.id=sms_credit_ledger.business_id and b.owner_id=(select auth.uid()))) with check(exists(select 1 from public.businesses b where b.id=sms_credit_ledger.business_id and b.owner_id=(select auth.uid())));
drop policy if exists appointment_services_owner_all on public.appointment_services;
create policy appointment_services_owner_all on public.appointment_services for all to authenticated using(exists(select 1 from public.businesses b where b.id=appointment_services.business_id and b.owner_id=(select auth.uid()))) with check(exists(select 1 from public.businesses b where b.id=appointment_services.business_id and b.owner_id=(select auth.uid())));
drop policy if exists appointments_owner_all on public.appointments;
create policy appointments_owner_all on public.appointments for all to authenticated using(exists(select 1 from public.businesses b where b.id=appointments.business_id and b.owner_id=(select auth.uid()))) with check(exists(select 1 from public.businesses b where b.id=appointments.business_id and b.owner_id=(select auth.uid())));
drop policy if exists digital_menus_owner_all on public.digital_menus;
create policy digital_menus_owner_all on public.digital_menus for all to authenticated using(exists(select 1 from public.businesses b where b.id=digital_menus.business_id and b.owner_id=(select auth.uid()))) with check(exists(select 1 from public.businesses b where b.id=digital_menus.business_id and b.owner_id=(select auth.uid())));
drop policy if exists menu_items_owner_all on public.menu_items;
create policy menu_items_owner_all on public.menu_items for all to authenticated using(exists(select 1 from public.digital_menus m join public.businesses b on b.id=m.business_id where m.id=menu_items.menu_id and b.owner_id=(select auth.uid()))) with check(exists(select 1 from public.digital_menus m join public.businesses b on b.id=m.business_id where m.id=menu_items.menu_id and b.owner_id=(select auth.uid())));
drop policy if exists kitchen_orders_owner_all on public.kitchen_orders;
create policy kitchen_orders_owner_all on public.kitchen_orders for all to authenticated using(exists(select 1 from public.businesses b where b.id=kitchen_orders.business_id and b.owner_id=(select auth.uid()))) with check(exists(select 1 from public.businesses b where b.id=kitchen_orders.business_id and b.owner_id=(select auth.uid())));
drop policy if exists waivers_owner_all on public.waivers;
create policy waivers_owner_all on public.waivers for all to authenticated using(exists(select 1 from public.businesses b where b.id=waivers.business_id and b.owner_id=(select auth.uid()))) with check(exists(select 1 from public.businesses b where b.id=waivers.business_id and b.owner_id=(select auth.uid())));
drop policy if exists waiver_signatures_owner_all on public.waiver_signatures;
create policy waiver_signatures_owner_all on public.waiver_signatures for all to authenticated using(exists(select 1 from public.businesses b where b.id=waiver_signatures.business_id and b.owner_id=(select auth.uid()))) with check(exists(select 1 from public.businesses b where b.id=waiver_signatures.business_id and b.owner_id=(select auth.uid())));