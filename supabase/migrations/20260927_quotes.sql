-- First-class quote entity and calculations.
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  quote_number text not null,
  status text not null default 'draft' check(status = any(array['draft','sent','viewed','accepted','rejected','expired','converted','cancelled'])),
  issue_date date not null default current_date,
  expiry_date date,
  currency text not null default 'USD',
  payment_terms text,
  reference text,
  purchase_order text,
  subtotal numeric(20,6) not null default 0,
  discount_type text check(discount_type in ('percentage','fixed') or discount_type is null),
  discount_value numeric(20,6) not null default 0,
  discount_amount numeric(20,6) not null default 0,
  tax_rate numeric(10,6) not null default 0,
  tax_name text,
  tax_amount numeric(20,6) not null default 0,
  total numeric(20,6) not null default 0,
  notes text,
  terms text,
  converted_invoice_id uuid references public.invoices(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists quotes_business_quote_number_uidx on public.quotes(business_id,quote_number);
create index if not exists quotes_business_customer_idx on public.quotes(business_id,customer_id,created_at desc);
create index if not exists quotes_business_status_idx on public.quotes(business_id,status,created_at desc);
create index if not exists quotes_expiry_idx on public.quotes(business_id,expiry_date,status);

create table if not exists public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  description text not null,
  quantity numeric(20,6) not null default 1 check(quantity > 0),
  unit text default 'unit',
  unit_price numeric(20,6) not null default 0 check(unit_price >= 0),
  line_total numeric(20,6) generated always as (round(quantity * unit_price,6)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists quote_items_quote_idx on public.quote_items(quote_id);

create or replace function public.next_quote_number(p_business_id uuid)
returns text
language plpgsql
security invoker
set search_path=public
as $function$
declare
  next_num integer;
begin
  if not exists(select 1 from public.businesses where id=p_business_id and owner_id=(select auth.uid()))
     then raise exception 'Not authorized'; end if;
  perform pg_advisory_xact_lock(hashtextextended('bizstack-quote:'||p_business_id::text,0));
  select coalesce(max(nullif(regexp_replace(quote_number,'[^0-9]','','g'),'')::integer),0)+1
  into next_num
  from public.quotes
  where business_id=p_business_id;
  return 'QUO-'||lpad(next_num::text,4,'0');
end
$function$;

create or replace function public.recalculate_quote_totals(p_quote_id uuid)
returns public.quotes
language plpgsql
security invoker
set search_path=public
as $function$
declare
  q public.quotes%rowtype;
  sub numeric(20,6);
  disc numeric(20,6);
  tax_base numeric(20,6);
  tax numeric(20,6);
begin
  select * into q from public.quotes where id=p_quote_id for update;
  if not found then raise exception 'Quote not found'; end if;
  if not exists(select 1 from public.businesses b where b.id=q.business_id and b.owner_id=(select auth.uid()))
     then raise exception 'Not authorized'; end if;

  select coalesce(sum(line_total),0) into sub from public.quote_items where quote_id=q.id;
  disc:=case
    when coalesce(q.discount_type,'')='percentage' then round(sub*least(greatest(q.discount_value,0),100)/100,6)
    when q.discount_type='fixed' then least(greatest(q.discount_value,0),sub)
    else 0
  end;
  tax_base:=greatest(sub-disc,0);
  tax:=round(tax_base*least(greatest(q.tax_rate,0),100)/100,6);

  update public.quotes set subtotal=sub,discount_amount=disc,tax_amount=tax,total=round(tax_base+tax,6),updated_at=now()
  where id=q.id
  returning * into q;
  return q;
end
$function$;

alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;

drop policy if exists quotes_owner_all on public.quotes;
create policy quotes_owner_all on public.quotes for all to authenticated
using (exists(select 1 from public.businesses b where b.id=quotes.business_id and b.owner_id=(select auth.uid())))
with check (exists(select 1 from public.businesses b where b.id=quotes.business_id and b.owner_id=(select auth.uid())));

drop policy if exists quote_items_owner_all on public.quote_items;
create policy quote_items_owner_all on public.quote_items for all to authenticated
using (exists(select 1 from public.quotes q join public.businesses b on b.id=q.business_id where q.id=quote_items.quote_id and b.owner_id=(select auth.uid())))
with check (exists(select 1 from public.quotes q join public.businesses b on b.id=q.business_id where q.id=quote_items.quote_id and b.owner_id=(select auth.uid())));

revoke all on function public.next_quote_number(uuid) from anon;
grant execute on function public.next_quote_number(uuid) to authenticated;
revoke all on function public.recalculate_quote_totals(uuid) from anon;
grant execute on function public.recalculate_quote_totals(uuid) to authenticated;