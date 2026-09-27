-- Agent/broker commission tracking and invoice commission calculation.
create table if not exists public.sales_agents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  status text not null default 'active' check(status = any(array['active','inactive'])),
  default_rate_percent numeric(10,6) not null default 0 check(default_rate_percent >= 0 and default_rate_percent <= 100),
  payout_method text,
  payout_reference text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sales_agents_business_name_idx on public.sales_agents(business_id,name);
create unique index if not exists sales_agents_business_name_uidx on public.sales_agents(business_id,lower(name));

create table if not exists public.commission_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  agent_id uuid not null references public.sales_agents(id) on delete restrict,
  source_type text not null check(source_type = any(array['invoice','cash_sale','order','subscription','manual'])),
  source_id uuid,
  customer_id uuid references public.customers(id) on delete set null,
  basis_amount numeric(20,6) not null check(basis_amount >= 0),
  currency text not null,
  rate_percent numeric(10,6) not null check(rate_percent >= 0 and rate_percent <= 100),
  commission_amount numeric(20,6) not null check(commission_amount >= 0),
  status text not null default 'pending' check(status = any(array['pending','approved','payable','paid','cancelled'])),
  payable_at timestamptz,
  paid_at timestamptz,
  payout_id uuid,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists commission_entries_business_agent_idx on public.commission_entries(business_id,agent_id,status,created_at desc);
create index if not exists commission_entries_source_idx on public.commission_entries(business_id,source_type,source_id);
create unique index if not exists commission_entries_source_agent_uidx
  on public.commission_entries(agent_id,source_type,source_id)
  where source_id is not null;

create table if not exists public.commission_payouts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  agent_id uuid not null references public.sales_agents(id) on delete restrict,
  payout_number text not null,
  amount numeric(20,6) not null check(amount >= 0),
  currency text not null,
  status text not null default 'draft' check(status = any(array['draft','scheduled','paid','cancelled'])),
  scheduled_at timestamptz,
  paid_at timestamptz,
  payout_method text,
  payout_reference text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists commission_payouts_business_number_uidx on public.commission_payouts(business_id,payout_number);
create index if not exists commission_payouts_agent_status_idx on public.commission_payouts(business_id,agent_id,status,created_at desc);

alter table public.sales_agents enable row level security;
alter table public.commission_entries enable row level security;
alter table public.commission_payouts enable row level security;

drop policy if exists sales_agents_owner_all on public.sales_agents;
create policy sales_agents_owner_all on public.sales_agents for all to authenticated
using(exists(select 1 from public.businesses b where b.id=sales_agents.business_id and b.owner_id=(select auth.uid())))
with check(exists(select 1 from public.businesses b where b.id=sales_agents.business_id and b.owner_id=(select auth.uid())));

drop policy if exists commission_entries_owner_all on public.commission_entries;
create policy commission_entries_owner_all on public.commission_entries for all to authenticated
using(exists(select 1 from public.businesses b where b.id=commission_entries.business_id and b.owner_id=(select auth.uid())))
with check(exists(select 1 from public.businesses b where b.id=commission_entries.business_id and b.owner_id=(select auth.uid())));

drop policy if exists commission_payouts_owner_all on public.commission_payouts;
create policy commission_payouts_owner_all on public.commission_payouts for all to authenticated
using(exists(select 1 from public.businesses b where b.id=commission_payouts.business_id and b.owner_id=(select auth.uid())))
with check(exists(select 1 from public.businesses b where b.id=commission_payouts.business_id and b.owner_id=(select auth.uid())));

create or replace function public.calculate_invoice_commission(
  p_invoice_id uuid,
  p_agent_id uuid,
  p_rate_percent numeric default null
) returns public.commission_entries
language plpgsql
security invoker
set search_path=public
as $function$
declare
  i public.invoices%rowtype;
  a public.sales_agents%rowtype;
  existing public.commission_entries%rowtype;
  rate numeric(10,6);
  amount numeric(20,6);
  entry public.commission_entries%rowtype;
begin
  select * into i from public.invoices where id=p_invoice_id;
  if not found then raise exception 'Invoice not found'; end if;
  if not exists(select 1 from public.businesses b where b.id=i.business_id and b.owner_id=(select auth.uid())) then raise exception 'Not authorized'; end if;

  select * into a from public.sales_agents where id=p_agent_id and business_id=i.business_id;
  if not found then raise exception 'Sales agent not found'; end if;

  select * into existing from public.commission_entries
  where business_id=i.business_id and agent_id=p_agent_id and source_type='invoice' and source_id=i.id;
  if found then return existing; end if;

  rate:=coalesce(p_rate_percent,a.default_rate_percent,0);
  if rate<0 or rate>100 then raise exception 'Commission rate must be between 0 and 100'; end if;
  amount:=round(coalesce(i.total,0)*rate/100,6);

  insert into public.commission_entries(
    business_id,agent_id,source_type,source_id,customer_id,basis_amount,currency,rate_percent,
    commission_amount,status,payable_at,created_by
  )
  values(
    i.business_id,a.id,'invoice',i.id,i.customer_id,coalesce(i.total,0),coalesce(i.currency,'USD'),
    rate,amount,'pending',case when i.status='paid' then now() else null end,auth.uid()
  )
  returning * into entry;

  insert into public.events(business_id,event_type,summary,evidence,status,priority,category,action_type)
  values(
    i.business_id,'commission.calculated',
    'Commission calculated for invoice '||i.invoice_number,
    jsonb_build_object('invoice_id',i.id,'agent_id',a.id,'commission_entry_id',entry.id,'rate_percent',rate,'commission_amount',amount,'currency',i.currency),
    'info','normal','sales','commission'
  );

  return entry;
end
$function$;

revoke all on function public.calculate_invoice_commission(uuid,uuid,numeric) from anon;
grant execute on function public.calculate_invoice_commission(uuid,uuid,numeric) to authenticated;
-- Payable commission preparation and payout lifecycle.
create or replace function public.prepare_paid_invoice_commissions(p_business_id uuid)
returns integer
language plpgsql
security invoker
set search_path=public
as $function$
declare changed integer;
begin
  if not exists(select 1 from public.businesses where id=p_business_id and owner_id=(select auth.uid()))
    then raise exception 'Not authorized'; end if;

  update public.commission_entries ce
  set status='payable',payable_at=coalesce(ce.payable_at,now()),updated_at=now()
  where ce.business_id=p_business_id
    and ce.status='pending'
    and ce.source_type='invoice'
    and exists(select 1 from public.invoices i where i.id=ce.source_id and i.business_id=p_business_id and i.status='paid');

  get diagnostics changed = row_count;
  return changed;
end
$function$;

create or replace function public.next_commission_payout_number(p_business_id uuid)
returns text
language plpgsql
security invoker
set search_path=public
as $function$
declare n integer;
begin
  if not exists(select 1 from public.businesses where id=p_business_id and owner_id=(select auth.uid()))
    then raise exception 'Not authorized'; end if;
  perform pg_advisory_xact_lock(hashtextextended('bizstack-commission-payout:'||p_business_id::text,0));
  select coalesce(max(nullif(regexp_replace(payout_number,'[^0-9]','','g'),'')::integer),0)+1
    into n from public.commission_payouts where business_id=p_business_id;
  return 'CPAY-'||lpad(n::text,6,'0');
end
$function$;

create or replace function public.create_commission_payout(p_agent_id uuid)
returns public.commission_payouts
language plpgsql
security invoker
set search_path=public
as $function$
declare
  a public.sales_agents%rowtype;
  payout public.commission_payouts%rowtype;
  total numeric(20,6);
  currency_value text;
  payout_no text;
begin
  select * into a from public.sales_agents where id=p_agent_id;
  if not found then raise exception 'Sales agent not found'; end if;
  if not exists(select 1 from public.businesses b where b.id=a.business_id and b.owner_id=(select auth.uid()))
    then raise exception 'Not authorized'; end if;

  select coalesce(sum(commission_amount),0),max(currency)
  into total,currency_value
  from public.commission_entries
  where business_id=a.business_id and agent_id=a.id and status='payable';

  if total <= 0 then raise exception 'No payable commission is available for this agent'; end if;

  payout_no:=public.next_commission_payout_number(a.business_id);
  insert into public.commission_payouts(
    business_id,agent_id,payout_number,amount,currency,status,payout_method,payout_reference,created_by
  )
  values(a.business_id,a.id,payout_no,total,coalesce(currency_value,a.payout_reference,'USD'),'draft',a.payout_method,a.payout_reference,auth.uid())
  returning * into payout;

  update public.commission_entries
  set payout_id=payout.id,updated_at=now()
  where business_id=a.business_id and agent_id=a.id and status='payable' and payout_id is null;

  return payout;
end
$function$;

create or replace function public.mark_commission_payout_paid(p_payout_id uuid)
returns public.commission_payouts
language plpgsql
security invoker
set search_path=public
as $function$
declare p public.commission_payouts%rowtype;
begin
  select * into p from public.commission_payouts where id=p_payout_id for update;
  if not found then raise exception 'Commission payout not found'; end if;
  if not exists(select 1 from public.businesses b where b.id=p.business_id and b.owner_id=(select auth.uid()))
    then raise exception 'Not authorized'; end if;
  if p.status='paid' then return p; end if;

  update public.commission_payouts
  set status='paid',paid_at=now(),updated_at=now()
  where id=p.id
  returning * into p;

  update public.commission_entries
  set status='paid',paid_at=now(),updated_at=now()
  where payout_id=p.id and business_id=p.business_id;

  insert into public.events(business_id,event_type,summary,evidence,status,priority,category,action_type)
  values(p.business_id,'commission.payout_paid','Commission payout '||p.payout_number||' marked paid',
    jsonb_build_object('payout_id',p.id,'agent_id',p.agent_id,'amount',p.amount,'currency',p.currency),
    'auto_handled','normal','finance','commission_payout');

  return p;
end
$function$;

revoke all on function public.prepare_paid_invoice_commissions(uuid) from anon;
grant execute on function public.prepare_paid_invoice_commissions(uuid) to authenticated;
revoke all on function public.next_commission_payout_number(uuid) from anon;
grant execute on function public.next_commission_payout_number(uuid) to authenticated;
revoke all on function public.create_commission_payout(uuid) from anon;
grant execute on function public.create_commission_payout(uuid) to authenticated;
revoke all on function public.mark_commission_payout_paid(uuid) from anon;
grant execute on function public.mark_commission_payout_paid(uuid) to authenticated;