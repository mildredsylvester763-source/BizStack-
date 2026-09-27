create extension if not exists pgcrypto;

alter table public.invoices
  add column if not exists paid_amount numeric not null default 0 check (paid_amount >= 0),
  add column if not exists tax_enabled boolean not null default false,
  add column if not exists tax_name text,
  add column if not exists tax_treatment text not null default 'none'
    check (tax_treatment in ('none','standard','zero_rated','exempt','reverse_charge','custom')),
  add column if not exists tax_inclusive boolean not null default false,
  add column if not exists tax_jurisdiction text,
  add column if not exists tax_registration_number text;

create table if not exists public.business_settings (
  id uuid primary key default gen_random_uuid(), business_id uuid not null unique references public.businesses(id) on delete cascade,
  tax_mode text not null default 'auto' check (tax_mode in ('auto','manual','disabled')),
  default_tax_rate numeric not null default 0 check (default_tax_rate >= 0),
  default_tax_name text, tax_registration_number text, tax_jurisdiction text,
  tax_inclusive boolean not null default false,
  invoice_settings jsonb not null default '{"show_logo":true,"show_customer_address":true,"show_tax":true,"show_discount":true,"show_shipping":false,"show_reference":true,"show_purchase_order":true,"show_notes":true,"show_terms":true,"show_product_image":false,"show_sku":true,"show_payment_details":true,"show_signature":false,"show_qr_payment":false}'::jsonb,
  module_settings jsonb not null default '{"tax":true,"inventory":true,"crm":true,"banking":true,"payments":true,"commerce":true,"marketing":true,"ai_automation":true}'::jsonb,
  sync_settings jsonb not null default '{"preferred_mode":"near_realtime","auto_reconcile":true,"auto_match_payments":true,"notify_sync_errors":true}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.financial_accounts (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  kind text not null check (kind in ('bank','payment_processor','cash','wallet','other')),
  provider text, display_name text not null, currency text not null, masked_identifier text,
  status text not null default 'pending' check (status in ('pending','active','disconnected','error')),
  external_account_id text, last_synced_at timestamptz, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (business_id, provider, external_account_id)
);

create table if not exists public.financial_transactions (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  financial_account_id uuid references public.financial_accounts(id) on delete set null,
  source_type text not null default 'manual' check (source_type in ('manual','bank','payment_processor','api','import','internal')),
  external_id text, external_reference text, direction text not null check (direction in ('inflow','outflow')),
  amount numeric not null check (amount >= 0), currency text not null,
  status text not null default 'posted' check (status in ('pending','posted','reversed','failed')),
  occurred_at timestamptz not null default now(), counterparty_name text, description text,
  invoice_id uuid references public.invoices(id) on delete set null,
  tax_amount numeric not null default 0 check (tax_amount >= 0), fee_amount numeric not null default 0 check (fee_amount >= 0),
  reconciled boolean not null default false,
  reconciliation_status text not null default 'unmatched' check (reconciliation_status in ('unmatched','matched','partially_matched','ignored','needs_review')),
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
  unique (business_id, source_type, external_id)
);

create table if not exists public.invoice_payments (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  transaction_id uuid references public.financial_transactions(id) on delete set null,
  amount numeric not null check (amount > 0), currency text not null, payment_date timestamptz not null default now(),
  method text, reference text, source text not null default 'manual' check (source in ('manual','bank','payment_processor','api','import')),
  status text not null default 'posted' check (status in ('pending','posted','failed','reversed')),
  fee_amount numeric not null default 0 check (fee_amount >= 0), notes text, created_at timestamptz not null default now()
);

create table if not exists public.money_buckets (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null, bucket_type text not null check (bucket_type in ('operating','tax','payroll','supplier','savings','emergency','custom')),
  currency text not null, allocated_amount numeric not null default 0 check (allocated_amount >= 0),
  is_system boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  provider text not null, category text not null check (category in ('banking','payments','accounting','commerce','crm','data','communications','productivity','operations','other')),
  connection_type text not null check (connection_type in ('oauth','api_key','webhook','database','file_import','native')),
  display_name text not null, status text not null default 'pending' check (status in ('pending','connected','error','disconnected')),
  sync_mode text not null default 'manual' check (sync_mode in ('realtime','near_realtime','scheduled','manual','none')),
  external_account_id text, last_synced_at timestamptz, last_event_at timestamptz, error_message text,
  capabilities jsonb not null default '{}'::jsonb, config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.integration_sync_records (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  integration_id uuid not null references public.integrations(id) on delete cascade,
  entity_type text not null, external_record_id text not null, local_entity_type text, local_record_id uuid,
  sync_status text not null default 'synced' check (sync_status in ('synced','pending','conflict','error','ignored')),
  content_hash text, external_updated_at timestamptz, last_synced_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb, unique (integration_id, entity_type, external_record_id)
);

create index if not exists financial_transactions_business_occurred_idx on public.financial_transactions (business_id, occurred_at desc);
create index if not exists invoice_payments_invoice_idx on public.invoice_payments (invoice_id, payment_date desc);
create index if not exists integrations_business_idx on public.integrations (business_id, category, status);
create index if not exists integration_sync_records_business_idx on public.integration_sync_records (business_id, last_synced_at desc);

alter table public.business_settings enable row level security;
alter table public.financial_accounts enable row level security;
alter table public.financial_transactions enable row level security;
alter table public.invoice_payments enable row level security;
alter table public.money_buckets enable row level security;
alter table public.integrations enable row level security;
alter table public.integration_sync_records enable row level security;

grant select, insert, update, delete on public.business_settings, public.financial_accounts, public.financial_transactions, public.invoice_payments, public.money_buckets, public.integrations, public.integration_sync_records to authenticated;

do $$
declare t text;
begin
  foreach t in array array['business_settings','financial_accounts','financial_transactions','invoice_payments','money_buckets','integrations','integration_sync_records'] loop
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

insert into public.business_settings (business_id) select id from public.businesses on conflict (business_id) do nothing;
insert into public.money_buckets (business_id,name,bucket_type,currency,is_system)
select id,'Operating Money','operating',coalesce(currency,'USD'),true from public.businesses b
where not exists (select 1 from public.money_buckets x where x.business_id=b.id and x.bucket_type='operating');
insert into public.money_buckets (business_id,name,bucket_type,currency,is_system)
select id,'Tax Reserve','tax',coalesce(currency,'USD'),true from public.businesses b
where not exists (select 1 from public.money_buckets x where x.business_id=b.id and x.bucket_type='tax');
insert into public.money_buckets (business_id,name,bucket_type,currency,is_system)
select id,'Payroll Reserve','payroll',coalesce(currency,'USD'),true from public.businesses b
where not exists (select 1 from public.money_buckets x where x.business_id=b.id and x.bucket_type='payroll');

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='invoices') then alter publication supabase_realtime add table public.invoices; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='financial_transactions') then alter publication supabase_realtime add table public.financial_transactions; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='invoice_payments') then alter publication supabase_realtime add table public.invoice_payments; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='integrations') then alter publication supabase_realtime add table public.integrations; end if;
end $$;