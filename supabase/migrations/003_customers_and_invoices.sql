create extension if not exists pgcrypto;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  created_at timestamptz not null default now()
);

create index if not exists customers_business_id_idx
  on public.customers (business_id);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  invoice_number text not null,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'paid', 'overdue')),
  due_date date,
  currency text not null default 'USD',
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  unique (business_id, invoice_number)
);

create index if not exists invoices_business_created_at_idx
  on public.invoices (business_id, created_at desc);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity numeric not null default 1,
  unit_price numeric not null
);

create index if not exists invoice_items_invoice_id_idx
  on public.invoice_items (invoice_id);

alter table public.customers enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;

drop policy if exists "Business owners can select customers" on public.customers;
drop policy if exists "Business owners can insert customers" on public.customers;
drop policy if exists "Business owners can update customers" on public.customers;
drop policy if exists "Business owners can delete customers" on public.customers;

create policy "Business owners can select customers"
  on public.customers
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.businesses
      where businesses.id = customers.business_id
        and businesses.owner_id = auth.uid()
    )
  );

create policy "Business owners can insert customers"
  on public.customers
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.businesses
      where businesses.id = customers.business_id
        and businesses.owner_id = auth.uid()
    )
  );

create policy "Business owners can update customers"
  on public.customers
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.businesses
      where businesses.id = customers.business_id
        and businesses.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.businesses
      where businesses.id = customers.business_id
        and businesses.owner_id = auth.uid()
    )
  );

create policy "Business owners can delete customers"
  on public.customers
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.businesses
      where businesses.id = customers.business_id
        and businesses.owner_id = auth.uid()
    )
  );

drop policy if exists "Business owners can select invoices" on public.invoices;
drop policy if exists "Business owners can insert invoices" on public.invoices;
drop policy if exists "Business owners can update invoices" on public.invoices;
drop policy if exists "Business owners can delete invoices" on public.invoices;

create policy "Business owners can select invoices"
  on public.invoices
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.businesses
      where businesses.id = invoices.business_id
        and businesses.owner_id = auth.uid()
    )
  );

create policy "Business owners can insert invoices"
  on public.invoices
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.businesses
      where businesses.id = invoices.business_id
        and businesses.owner_id = auth.uid()
    )
  );

create policy "Business owners can update invoices"
  on public.invoices
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.businesses
      where businesses.id = invoices.business_id
        and businesses.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.businesses
      where businesses.id = invoices.business_id
        and businesses.owner_id = auth.uid()
    )
  );

create policy "Business owners can delete invoices"
  on public.invoices
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.businesses
      where businesses.id = invoices.business_id
        and businesses.owner_id = auth.uid()
    )
  );

drop policy if exists "Business owners can select invoice items" on public.invoice_items;
drop policy if exists "Business owners can insert invoice items" on public.invoice_items;
drop policy if exists "Business owners can update invoice items" on public.invoice_items;
drop policy if exists "Business owners can delete invoice items" on public.invoice_items;

create policy "Business owners can select invoice items"
  on public.invoice_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.invoices
      join public.businesses on businesses.id = invoices.business_id
      where invoices.id = invoice_items.invoice_id
        and businesses.owner_id = auth.uid()
    )
  );

create policy "Business owners can insert invoice items"
  on public.invoice_items
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.invoices
      join public.businesses on businesses.id = invoices.business_id
      where invoices.id = invoice_items.invoice_id
        and businesses.owner_id = auth.uid()
    )
  );

create policy "Business owners can update invoice items"
  on public.invoice_items
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.invoices
      join public.businesses on businesses.id = invoices.business_id
      where invoices.id = invoice_items.invoice_id
        and businesses.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.invoices
      join public.businesses on businesses.id = invoices.business_id
      where invoices.id = invoice_items.invoice_id
        and businesses.owner_id = auth.uid()
    )
  );

create policy "Business owners can delete invoice items"
  on public.invoice_items
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.invoices
      join public.businesses on businesses.id = invoices.business_id
      where invoices.id = invoice_items.invoice_id
        and businesses.owner_id = auth.uid()
    )
  );
