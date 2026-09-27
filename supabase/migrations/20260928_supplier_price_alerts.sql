-- Supplier price history and automated increase alerts.
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  currency text,
  status text not null default 'active' check(status = any(array['active','inactive','blocked'])),
  notes text,
  tags text[] not null default '{}',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists suppliers_business_name_idx on public.suppliers(business_id,name);
create unique index if not exists suppliers_business_name_uidx on public.suppliers(business_id,lower(name));

create table if not exists public.supplier_products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  supplier_sku text,
  unit_cost numeric(20,6) not null check(unit_cost >= 0),
  currency text not null default 'USD',
  minimum_order_quantity numeric(20,6) not null default 1 check(minimum_order_quantity > 0),
  lead_time_days integer check(lead_time_days is null or lead_time_days >= 0),
  alert_threshold_percent numeric(10,4) not null default 5 check(alert_threshold_percent >= 0),
  is_preferred boolean not null default false,
  last_seen_cost numeric(20,6),
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(supplier_id,product_id)
);
create index if not exists supplier_products_business_product_idx on public.supplier_products(business_id,product_id);
create index if not exists supplier_products_supplier_idx on public.supplier_products(supplier_id);

create table if not exists public.supplier_price_history (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  supplier_product_id uuid not null references public.supplier_products(id) on delete cascade,
  previous_cost numeric(20,6),
  new_cost numeric(20,6) not null,
  currency text not null,
  observed_at timestamptz not null default now(),
  source text not null default 'manual',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists supplier_price_history_lookup_idx on public.supplier_price_history(supplier_product_id,observed_at desc);

create table if not exists public.supplier_price_alerts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  supplier_product_id uuid not null references public.supplier_products(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  previous_cost numeric(20,6),
  new_cost numeric(20,6) not null,
  change_amount numeric(20,6),
  change_percent numeric(20,6),
  currency text not null,
  status text not null default 'pending' check(status = any(array['pending','acknowledged','dismissed','resolved'])),
  severity text not null default 'medium' check(severity = any(array['low','medium','high','critical'])),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists supplier_price_alerts_business_status_idx on public.supplier_price_alerts(business_id,status,created_at desc);

alter table public.suppliers enable row level security;
alter table public.supplier_products enable row level security;
alter table public.supplier_price_history enable row level security;
alter table public.supplier_price_alerts enable row level security;

drop policy if exists suppliers_owner_all on public.suppliers;
create policy suppliers_owner_all on public.suppliers for all to authenticated
using(exists(select 1 from public.businesses b where b.id=suppliers.business_id and b.owner_id=(select auth.uid())))
with check(exists(select 1 from public.businesses b where b.id=suppliers.business_id and b.owner_id=(select auth.uid())));

drop policy if exists supplier_products_owner_all on public.supplier_products;
create policy supplier_products_owner_all on public.supplier_products for all to authenticated
using(exists(select 1 from public.businesses b where b.id=supplier_products.business_id and b.owner_id=(select auth.uid())))
with check(exists(select 1 from public.businesses b where b.id=supplier_products.business_id and b.owner_id=(select auth.uid())));

drop policy if exists supplier_price_history_owner_all on public.supplier_price_history;
create policy supplier_price_history_owner_all on public.supplier_price_history for all to authenticated
using(exists(select 1 from public.businesses b where b.id=supplier_price_history.business_id and b.owner_id=(select auth.uid())))
with check(exists(select 1 from public.businesses b where b.id=supplier_price_history.business_id and b.owner_id=(select auth.uid())));

drop policy if exists supplier_price_alerts_owner_all on public.supplier_price_alerts;
create policy supplier_price_alerts_owner_all on public.supplier_price_alerts for all to authenticated
using(exists(select 1 from public.businesses b where b.id=supplier_price_alerts.business_id and b.owner_id=(select auth.uid())))
with check(exists(select 1 from public.businesses b where b.id=supplier_price_alerts.business_id and b.owner_id=(select auth.uid())));

create or replace function public.record_supplier_price(
  p_business_id uuid,
  p_supplier_id uuid,
  p_product_id uuid,
  p_new_cost numeric,
  p_currency text,
  p_source text default 'manual'
) returns public.supplier_price_alerts
language plpgsql
security invoker
set search_path=public
as $function$
declare
  sp public.supplier_products%rowtype;
  old_cost numeric;
  change_amt numeric;
  change_pct numeric;
  threshold numeric;
  alert public.supplier_price_alerts%rowtype;
  severity_value text;
begin
  if not exists(select 1 from public.businesses where id=p_business_id and owner_id=(select auth.uid()))
    then raise exception 'Not authorized'; end if;
  if p_new_cost is null or p_new_cost < 0 then raise exception 'Supplier cost must be zero or greater'; end if;

  select * into sp
  from public.supplier_products
  where business_id=p_business_id and supplier_id=p_supplier_id and product_id=p_product_id
  for update;

  if not found then
    insert into public.supplier_products(business_id,supplier_id,product_id,unit_cost,currency,last_seen_cost,last_seen_at)
    values(p_business_id,p_supplier_id,p_product_id,p_new_cost,upper(p_currency),p_new_cost,now())
    returning * into sp;
    return null;
  end if;

  old_cost:=sp.unit_cost;
  threshold:=coalesce(sp.alert_threshold_percent,5);
  change_amt:=p_new_cost-old_cost;
  change_pct:=case when old_cost>0 then (change_amt/old_cost)*100 else case when p_new_cost>0 then 100 else 0 end end;

  insert into public.supplier_price_history(business_id,supplier_product_id,previous_cost,new_cost,currency,source,metadata)
  values(p_business_id,sp.id,old_cost,p_new_cost,upper(p_currency),coalesce(nullif(p_source,''),'manual'),jsonb_build_object('threshold_percent',threshold));

  update public.supplier_products
  set unit_cost=p_new_cost,currency=upper(p_currency),last_seen_cost=p_new_cost,last_seen_at=now(),updated_at=now()
  where id=sp.id;

  if change_pct >= threshold then
    severity_value:=case when change_pct>=50 then 'critical' when change_pct>=25 then 'high' when change_pct>=10 then 'medium' else 'low' end;
    insert into public.supplier_price_alerts(
      business_id,supplier_product_id,product_id,supplier_id,previous_cost,new_cost,
      change_amount,change_percent,currency,status,severity,metadata
    )
    values(
      p_business_id,sp.id,p_product_id,p_supplier_id,old_cost,p_new_cost,change_amt,change_pct,
      upper(p_currency),'pending',severity_value,jsonb_build_object('threshold_percent',threshold,'source',p_source)
    )
    returning * into alert;

    insert into public.events(business_id,event_type,summary,evidence,status,priority,category,action_type)
    values(
      p_business_id,'supplier.price_increase',
      'Supplier cost increased by '||round(change_pct,2)||'% for product '||p_product_id::text,
      jsonb_build_object('supplier_id',p_supplier_id,'product_id',p_product_id,'supplier_product_id',sp.id,'previous_cost',old_cost,'new_cost',p_new_cost,'change_percent',change_pct,'currency',upper(p_currency),'alert_id',alert.id),
      'needs_attention',case when severity_value in ('high','critical') then 'high' else 'normal' end,'inventory','supplier_price_alert'
    );
    return alert;
  end if;

  return null;
end
$function$;

revoke all on function public.record_supplier_price(uuid,uuid,uuid,numeric,text,text) from anon;
grant execute on function public.record_supplier_price(uuid,uuid,uuid,numeric,text,text) to authenticated;