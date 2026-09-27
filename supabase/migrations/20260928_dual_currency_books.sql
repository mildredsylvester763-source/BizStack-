-- Auditable dual-currency bookkeeping primitives.
alter table public.financial_transactions
  add column if not exists base_amount numeric(20,6),
  add column if not exists base_currency text,
  add column if not exists fx_rate numeric(20,10),
  add column if not exists fx_rate_source text,
  add column if not exists fx_rate_at timestamptz;

update public.financial_transactions ft
set base_currency=coalesce(ft.base_currency,b.currency),
    base_amount=coalesce(ft.base_amount,ft.amount),
    fx_rate=coalesce(ft.fx_rate,1),
    fx_rate_source=coalesce(ft.fx_rate_source,'same_currency'),
    fx_rate_at=coalesce(ft.fx_rate_at,ft.occurred_at,ft.created_at)
from public.businesses b
where b.id=ft.business_id;

alter table public.financial_transactions
  alter column base_currency set default 'USD',
  alter column base_amount set default 0,
  alter column fx_rate set default 1;

alter table public.financial_transactions drop constraint if exists financial_transactions_fx_rate_ck;
alter table public.financial_transactions add constraint financial_transactions_fx_rate_ck check (fx_rate is null or fx_rate > 0);

alter table public.financial_transactions drop constraint if exists financial_transactions_base_amount_ck;
alter table public.financial_transactions add constraint financial_transactions_base_amount_ck check (base_amount is null or base_amount >= 0);

create index if not exists financial_transactions_business_currency_idx on public.financial_transactions(business_id,currency,occurred_at desc);
create index if not exists financial_transactions_business_base_currency_idx on public.financial_transactions(business_id,base_currency,occurred_at desc);

create table if not exists public.business_exchange_rates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  from_currency text not null,
  to_currency text not null,
  rate numeric(20,10) not null check(rate > 0),
  source text not null default 'manual',
  effective_at timestamptz not null default now(),
  expires_at timestamptz,
  is_active boolean not null default true,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_exchange_rates_currency_pair_ck check(from_currency <> to_currency)
);

create index if not exists business_exchange_rates_lookup_idx on public.business_exchange_rates(business_id,from_currency,to_currency,is_active,effective_at desc);

alter table public.business_exchange_rates enable row level security;
drop policy if exists business_exchange_rates_owner_all on public.business_exchange_rates;
create policy business_exchange_rates_owner_all on public.business_exchange_rates for all to authenticated
using(exists(select 1 from public.businesses b where b.id=business_exchange_rates.business_id and b.owner_id=(select auth.uid())))
with check(exists(select 1 from public.businesses b where b.id=business_exchange_rates.business_id and b.owner_id=(select auth.uid())));

create or replace function public.set_business_exchange_rate(p_business_id uuid,p_from_currency text,p_to_currency text,p_rate numeric,p_source text default 'manual',p_effective_at timestamptz default now(),p_notes text default null)
returns public.business_exchange_rates
language plpgsql security invoker set search_path=public
as $function$
declare r public.business_exchange_rates%rowtype;
begin
 if not exists(select 1 from public.businesses where id=p_business_id and owner_id=(select auth.uid())) then raise exception 'Not authorized'; end if;
 if p_from_currency is null or p_to_currency is null or upper(trim(p_from_currency))=upper(trim(p_to_currency)) then raise exception 'Currency pair must contain two different currencies'; end if;
 if p_rate is null or p_rate<=0 then raise exception 'FX rate must be greater than zero'; end if;
 update public.business_exchange_rates set is_active=false,updated_at=now()
 where business_id=p_business_id and from_currency=upper(trim(p_from_currency)) and to_currency=upper(trim(p_to_currency)) and is_active=true;
 insert into public.business_exchange_rates(business_id,from_currency,to_currency,rate,source,effective_at,notes,created_by)
 values(p_business_id,upper(trim(p_from_currency)),upper(trim(p_to_currency)),p_rate,coalesce(nullif(trim(p_source),''),'manual'),coalesce(p_effective_at,now()),p_notes,auth.uid())
 returning * into r;
 return r;
end
$function$;

create or replace function public.get_business_exchange_rate(p_business_id uuid,p_from_currency text,p_to_currency text,p_at timestamptz default now())
returns numeric
language plpgsql security invoker set search_path=public
as $function$
declare r numeric;
begin
 if upper(trim(p_from_currency))=upper(trim(p_to_currency)) then return 1; end if;
 if not exists(select 1 from public.businesses where id=p_business_id and owner_id=(select auth.uid())) then raise exception 'Not authorized'; end if;
 select ber.rate into r from public.business_exchange_rates ber
 where ber.business_id=p_business_id and ber.from_currency=upper(trim(p_from_currency)) and ber.to_currency=upper(trim(p_to_currency))
 and ber.is_active=true and ber.effective_at<=coalesce(p_at,now()) and (ber.expires_at is null or ber.expires_at>coalesce(p_at,now()))
 order by ber.effective_at desc limit 1;
 if r is null then
   select 1/ber.rate into r from public.business_exchange_rates ber
   where ber.business_id=p_business_id and ber.from_currency=upper(trim(p_to_currency)) and ber.to_currency=upper(trim(p_from_currency))
   and ber.is_active=true and ber.effective_at<=coalesce(p_at,now()) and (ber.expires_at is null or ber.expires_at>coalesce(p_at,now()))
   order by ber.effective_at desc limit 1;
 end if;
 if r is null then raise exception 'No active FX rate for % to %',p_from_currency,p_to_currency; end if;
 return r;
end
$function$;

revoke all on function public.set_business_exchange_rate(uuid,text,text,numeric,text,timestamptz,text) from anon;
grant execute on function public.set_business_exchange_rate(uuid,text,text,numeric,text,timestamptz,text) to authenticated;
revoke all on function public.get_business_exchange_rate(uuid,text,text,timestamptz) from anon;
grant execute on function public.get_business_exchange_rate(uuid,text,text,timestamptz) to authenticated;