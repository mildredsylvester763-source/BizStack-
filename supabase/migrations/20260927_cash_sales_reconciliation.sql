-- Cash sales and daily register reconciliation.
create table if not exists public.cash_register_sessions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  location_id uuid references public.business_locations(id) on delete set null,
  opened_by uuid not null references auth.users(id) on delete restrict,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  status text not null default 'open' check(status = any(array['open','closed','reconciled','cancelled'])),
  currency text not null default 'USD',
  opening_float numeric(20,6) not null default 0 check(opening_float >= 0),
  closing_cash_counted numeric(20,6),
  expected_cash numeric(20,6) not null default 0,
  cash_variance numeric(20,6),
  sales_count integer not null default 0,
  cash_sales_total numeric(20,6) not null default 0,
  card_sales_total numeric(20,6) not null default 0,
  transfer_sales_total numeric(20,6) not null default 0,
  other_sales_total numeric(20,6) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists cash_register_open_session_uidx
on public.cash_register_sessions(business_id)
where status='open';

create index if not exists cash_register_sessions_business_date_idx
on public.cash_register_sessions(business_id,opened_at desc);

create table if not exists public.cash_sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  session_id uuid not null references public.cash_register_sessions(id) on delete restrict,
  customer_id uuid references public.customers(id) on delete set null,
  sale_number text not null,
  sale_at timestamptz not null default now(),
  status text not null default 'completed' check(status = any(array['completed','voided','refunded'])),
  payment_method text not null default 'cash' check(payment_method = any(array['cash','card','bank_transfer','mobile_money','other'])),
  currency text not null default 'USD',
  subtotal numeric(20,6) not null default 0,
  discount_amount numeric(20,6) not null default 0,
  tax_rate numeric(10,6) not null default 0,
  tax_amount numeric(20,6) not null default 0,
  total numeric(20,6) not null default 0,
  amount_received numeric(20,6) not null default 0,
  change_amount numeric(20,6) not null default 0,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists cash_sales_business_sale_number_uidx on public.cash_sales(business_id,sale_number);
create index if not exists cash_sales_session_idx on public.cash_sales(session_id,sale_at desc);
create index if not exists cash_sales_business_customer_idx on public.cash_sales(business_id,customer_id,sale_at desc);

create table if not exists public.cash_sale_items (
  id uuid primary key default gen_random_uuid(),
  cash_sale_id uuid not null references public.cash_sales(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  description text not null,
  quantity numeric(20,6) not null check(quantity > 0),
  unit text default 'unit',
  unit_price numeric(20,6) not null check(unit_price >= 0),
  line_total numeric(20,6) generated always as (round(quantity*unit_price,6)) stored,
  created_at timestamptz not null default now()
);

create index if not exists cash_sale_items_sale_idx on public.cash_sale_items(cash_sale_id);
create index if not exists cash_sale_items_product_idx on public.cash_sale_items(product_id);

create or replace function public.next_cash_sale_number(p_business_id uuid)
returns text
language plpgsql
security invoker
set search_path=public
as $function$
declare n integer;
begin
  if not exists(select 1 from public.businesses where id=p_business_id and owner_id=(select auth.uid()))
    then raise exception 'Not authorized'; end if;
  perform pg_advisory_xact_lock(hashtextextended('bizstack-cash-sale:'||p_business_id::text,0));
  select coalesce(max(nullif(regexp_replace(sale_number,'[^0-9]','','g'),'')::integer),0)+1
    into n from public.cash_sales where business_id=p_business_id;
  return 'SALE-'||lpad(n::text,6,'0');
end
$function$;

create or replace function public.recalculate_cash_register_session(p_session_id uuid)
returns public.cash_register_sessions
language plpgsql
security invoker
set search_path=public
as $function$
declare s public.cash_register_sessions%rowtype;
begin
  select * into s from public.cash_register_sessions where id=p_session_id for update;
  if not found then raise exception 'Register session not found'; end if;
  if not exists(select 1 from public.businesses b where b.id=s.business_id and b.owner_id=(select auth.uid()))
    then raise exception 'Not authorized'; end if;

  update public.cash_register_sessions
  set sales_count=(select count(*) from public.cash_sales where session_id=s.id and status='completed'),
      cash_sales_total=coalesce((select sum(total) from public.cash_sales where session_id=s.id and status='completed' and payment_method='cash'),0),
      card_sales_total=coalesce((select sum(total) from public.cash_sales where session_id=s.id and status='completed' and payment_method='card'),0),
      transfer_sales_total=coalesce((select sum(total) from public.cash_sales where session_id=s.id and status='completed' and payment_method='bank_transfer'),0),
      other_sales_total=coalesce((select sum(total) from public.cash_sales where session_id=s.id and status='completed' and payment_method in ('mobile_money','other')),0),
      expected_cash=s.opening_float+coalesce((select sum(amount_received-change_amount) from public.cash_sales where session_id=s.id and status='completed' and payment_method='cash'),0),
      updated_at=now()
  where id=s.id
  returning * into s;

  if s.closing_cash_counted is not null then
    update public.cash_register_sessions
    set cash_variance=round(s.closing_cash_counted-s.expected_cash,6)
    where id=s.id
    returning * into s;
  end if;
  return s;
end
$function$;

create or replace function public.record_cash_sale(
  p_session_id uuid,
  p_customer_id uuid,
  p_currency text,
  p_payment_method text,
  p_amount_received numeric,
  p_notes text,
  p_items jsonb
) returns public.cash_sales
language plpgsql
security invoker
set search_path=public
as $function$
declare
  s public.cash_register_sessions%rowtype;
  sale public.cash_sales%rowtype;
  item jsonb;
  product_row public.products%rowtype;
  sale_no text;
  sub numeric(20,6);
  tax numeric(20,6);
  total numeric(20,6);
  received numeric(20,6);
  change numeric(20,6);
  qty numeric(20,6);
begin
  select * into s from public.cash_register_sessions where id=p_session_id for update;
  if not found then raise exception 'Register session not found'; end if;
  if not exists(select 1 from public.businesses b where b.id=s.business_id and b.owner_id=(select auth.uid()))
    then raise exception 'Not authorized'; end if;
  if s.status <> 'open' then raise exception 'Register session is not open'; end if;
  if p_currency is null or p_currency='' then raise exception 'Currency is required'; end if;
  if p_payment_method not in ('cash','card','bank_transfer','mobile_money','other') then raise exception 'Unsupported payment method'; end if;
  if jsonb_typeof(coalesce(p_items,'[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_items,'[]'::jsonb))=0 then raise exception 'At least one sale item is required'; end if;

  sale_no := public.next_cash_sale_number(s.business_id);
  insert into public.cash_sales(business_id,session_id,customer_id,sale_number,status,payment_method,currency,created_by,notes)
  values(s.business_id,s.id,p_customer_id,sale_no,'completed',p_payment_method,p_currency,auth.uid(),p_notes)
  returning * into sale;

  for item in select * from jsonb_array_elements(p_items)
  loop
    if (item->>'product_id') is not null then
      select * into product_row from public.products where id=(item->>'product_id')::uuid and business_id=s.business_id for update;
      if not found then raise exception 'Product not found'; end if;
      qty := coalesce((item->>'quantity')::numeric,0);
      if qty<=0 then raise exception 'Sale quantity must be positive'; end if;
      if product_row.stock_quantity < qty then raise exception 'Insufficient stock for product %',product_row.name; end if;
      insert into public.cash_sale_items(cash_sale_id,product_id,description,quantity,unit,unit_price)
      values(sale.id,product_row.id,product_row.name,qty,coalesce(product_row.unit,'unit'),coalesce((item->>'unit_price')::numeric,product_row.unit_price));
      update public.products set stock_quantity=stock_quantity-qty where id=product_row.id;
      insert into public.stock_movements(product_id,business_id,change,reason,note)
      values(product_row.id,s.business_id,-qty,'cash_sale','Cash sale '||sale_no);
    else
      qty := coalesce((item->>'quantity')::numeric,0);
      if qty<=0 then raise exception 'Sale quantity must be positive'; end if;
      insert into public.cash_sale_items(cash_sale_id,description,quantity,unit,unit_price)
      values(sale.id,coalesce(item->>'description','Item'),qty,coalesce(item->>'unit','unit'),coalesce((item->>'unit_price')::numeric,0));
    end if;
  end loop;

  select coalesce(sum(line_total),0) into sub from public.cash_sale_items where cash_sale_id=sale.id;
  total := sub;
  received := greatest(coalesce(p_amount_received,total),0);
  if p_payment_method='cash' and received < total then raise exception 'Cash received is less than the sale total'; end if;
  change := case when p_payment_method='cash' then greatest(received-total,0) else 0 end;

  update public.cash_sales
  set subtotal=sub,total=round(total,6),amount_received=received,change_amount=change,updated_at=now()
  where id=sale.id returning * into sale;

  perform public.recalculate_cash_register_session(s.id);

  insert into public.events(business_id,event_type,summary,evidence,status,priority,category,action_type)
  values(s.business_id,'cash_sale.completed','Cash sale '||sale.sale_number||' completed',
    jsonb_build_object('cash_sale_id',sale.id,'session_id',s.id,'total',sale.total,'payment_method',sale.payment_method),
    'info','normal','sales','cash_sale');

  return sale;
end
$function$;

create or replace function public.reconcile_cash_register_session(p_session_id uuid,p_counted_cash numeric,p_notes text default null)
returns public.cash_register_sessions
language plpgsql
security invoker
set search_path=public
as $function$
declare s public.cash_register_sessions%rowtype;
begin
  select * into s from public.cash_register_sessions where id=p_session_id for update;
  if not found then raise exception 'Register session not found'; end if;
  if not exists(select 1 from public.businesses b where b.id=s.business_id and b.owner_id=(select auth.uid()))
    then raise exception 'Not authorized'; end if;
  if s.status <> 'open' then raise exception 'Register session is not open'; end if;
  if p_counted_cash<0 then raise exception 'Counted cash cannot be negative'; end if;

  select * into s from public.recalculate_cash_register_session(s.id);
  update public.cash_register_sessions
  set closing_cash_counted=p_counted_cash,cash_variance=round(p_counted_cash-s.expected_cash,6),status='reconciled',closed_at=now(),notes=coalesce(p_notes,notes),updated_at=now()
  where id=s.id returning * into s;

  insert into public.events(business_id,event_type,summary,evidence,status,priority,category,action_type)
  values(s.business_id,'cash_register.reconciled','Cash register reconciled with variance '||s.cash_variance,
    jsonb_build_object('session_id',s.id,'expected_cash',s.expected_cash,'counted_cash',s.closing_cash_counted,'variance',s.cash_variance,'sales_count',s.sales_count),
    case when abs(s.cash_variance)<0.01 then 'info' else 'needs_attention' end,
    case when abs(s.cash_variance)<0.01 then 'normal' else 'high' end,
    'sales','reconcile_cash');

  return s;
end
$function$;

alter table public.cash_register_sessions enable row level security;
alter table public.cash_sales enable row level security;
alter table public.cash_sale_items enable row level security;

drop policy if exists cash_register_sessions_owner_all on public.cash_register_sessions;
create policy cash_register_sessions_owner_all on public.cash_register_sessions for all to authenticated
using (exists(select 1 from public.businesses b where b.id=cash_register_sessions.business_id and b.owner_id=(select auth.uid())))
with check (exists(select 1 from public.businesses b where b.id=cash_register_sessions.business_id and b.owner_id=(select auth.uid())));

drop policy if exists cash_sales_owner_all on public.cash_sales;
create policy cash_sales_owner_all on public.cash_sales for all to authenticated
using (exists(select 1 from public.businesses b where b.id=cash_sales.business_id and b.owner_id=(select auth.uid())))
with check (exists(select 1 from public.businesses b where b.id=cash_sales.business_id and b.owner_id=(select auth.uid())));

drop policy if exists cash_sale_items_owner_all on public.cash_sale_items;
create policy cash_sale_items_owner_all on public.cash_sale_items for all to authenticated
using (exists(select 1 from public.cash_sales s join public.businesses b on b.id=s.business_id where s.id=cash_sale_items.cash_sale_id and b.owner_id=(select auth.uid())))
with check (exists(select 1 from public.cash_sales s join public.businesses b on b.id=s.business_id where s.id=cash_sale_items.cash_sale_id and b.owner_id=(select auth.uid())));

revoke all on function public.next_cash_sale_number(uuid) from anon;
grant execute on function public.next_cash_sale_number(uuid) to authenticated;
revoke all on function public.recalculate_cash_register_session(uuid) from anon;
grant execute on function public.recalculate_cash_register_session(uuid) to authenticated;
revoke all on function public.record_cash_sale(uuid,uuid,text,text,numeric,text,jsonb) from anon;
grant execute on function public.record_cash_sale(uuid,uuid,text,text,numeric,text,jsonb) to authenticated;
revoke all on function public.reconcile_cash_register_session(uuid,numeric,text) from anon;
grant execute on function public.reconcile_cash_register_session(uuid,numeric,text) to authenticated;