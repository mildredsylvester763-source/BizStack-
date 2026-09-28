-- Dual-currency books, financing readiness, scheduled obligations and payroll advances.
create table if not exists public.business_currencies (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  currency_code text not null,
  is_base boolean not null default false,
  decimal_places integer not null default 2 check(decimal_places between 0 and 6),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique(business_id,currency_code)
);
create unique index if not exists business_currencies_one_base_uidx on public.business_currencies(business_id) where is_base;

create table if not exists public.financing_profiles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  purpose text,
  requested_amount numeric(20,6),
  currency text,
  term_months integer,
  collateral text,
  use_of_funds text,
  owner_contribution numeric(20,6),
  annual_revenue numeric(20,6),
  annual_profit numeric(20,6),
  existing_debt numeric(20,6),
  monthly_debt_service numeric(20,6),
  repayment_capacity numeric(20,6),
  score numeric(8,4),
  score_band text,
  strengths jsonb not null default '[]'::jsonb,
  gaps jsonb not null default '[]'::jsonb,
  lender_pack jsonb not null default '{}'::jsonb,
  last_scored_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists financing_profiles_business_uidx on public.financing_profiles(business_id);

create table if not exists public.business_obligations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  obligation_type text not null check(obligation_type = any(array['rent','utility','fleet','generator_fuel','cold_storage','subscription','other'])),
  title text not null,
  counterparty text,
  amount numeric(20,6) not null check(amount >= 0),
  currency text not null,
  frequency text not null default 'monthly' check(frequency = any(array['once','weekly','monthly','quarterly','yearly'])),
  next_due_date date,
  auto_record boolean not null default false,
  status text not null default 'active' check(status = any(array['active','paused','completed','cancelled'])),
  payment_account_id uuid references public.financial_accounts(id) on delete set null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists business_obligations_due_idx on public.business_obligations(business_id,status,next_due_date);
create index if not exists business_obligations_type_idx on public.business_obligations(business_id,obligation_type,status);

create table if not exists public.workforce_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  role_title text,
  department text,
  monthly_pay numeric(20,6) not null default 0,
  currency text not null,
  status text not null default 'active' check(status = any(array['active','inactive','terminated'])),
  payout_method text,
  payout_reference text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists workforce_members_business_status_idx on public.workforce_members(business_id,status);

create table if not exists public.payroll_advances (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  workforce_member_id uuid not null references public.workforce_members(id) on delete restrict,
  amount numeric(20,6) not null check(amount > 0),
  currency text not null,
  requested_at timestamptz not null default now(),
  recovery_start_date date,
  recovery_periods integer not null default 1 check(recovery_periods > 0),
  recovered_amount numeric(20,6) not null default 0,
  outstanding_amount numeric(20,6) not null,
  status text not null default 'active' check(status = any(array['pending','active','repaid','cancelled'])),
  recovery_method text not null default 'payroll_deduction',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payroll_advances_member_status_idx on public.payroll_advances(business_id,workforce_member_id,status);
create index if not exists payroll_advances_outstanding_idx on public.payroll_advances(business_id,status,outstanding_amount);

alter table public.business_currencies enable row level security;
alter table public.financing_profiles enable row level security;
alter table public.business_obligations enable row level security;
alter table public.workforce_members enable row level security;
alter table public.payroll_advances enable row level security;

drop policy if exists business_currencies_owner_all on public.business_currencies;
create policy business_currencies_owner_all on public.business_currencies for all to authenticated
using(exists(select 1 from public.businesses b where b.id=business_currencies.business_id and b.owner_id=(select auth.uid())))
with check(exists(select 1 from public.businesses b where b.id=business_currencies.business_id and b.owner_id=(select auth.uid())));

drop policy if exists financing_profiles_owner_all on public.financing_profiles;
create policy financing_profiles_owner_all on public.financing_profiles for all to authenticated
using(exists(select 1 from public.businesses b where b.id=financing_profiles.business_id and b.owner_id=(select auth.uid())))
with check(exists(select 1 from public.businesses b where b.id=financing_profiles.business_id and b.owner_id=(select auth.uid())));

drop policy if exists business_obligations_owner_all on public.business_obligations;
create policy business_obligations_owner_all on public.business_obligations for all to authenticated
using(exists(select 1 from public.businesses b where b.id=business_obligations.business_id and b.owner_id=(select auth.uid())))
with check(exists(select 1 from public.businesses b where b.id=business_obligations.business_id and b.owner_id=(select auth.uid())));

drop policy if exists workforce_members_owner_all on public.workforce_members;
create policy workforce_members_owner_all on public.workforce_members for all to authenticated
using(exists(select 1 from public.businesses b where b.id=workforce_members.business_id and b.owner_id=(select auth.uid())))
with check(exists(select 1 from public.businesses b where b.id=workforce_members.business_id and b.owner_id=(select auth.uid())));

drop policy if exists payroll_advances_owner_all on public.payroll_advances;
create policy payroll_advances_owner_all on public.payroll_advances for all to authenticated
using(exists(select 1 from public.businesses b join public.workforce_members w on w.business_id=b.id where w.id=payroll_advances.workforce_member_id and b.owner_id=(select auth.uid())))
with check(exists(select 1 from public.businesses b join public.workforce_members w on w.business_id=b.id where w.id=payroll_advances.workforce_member_id and b.owner_id=(select auth.uid())));

create or replace function public.calculate_financing_readiness(p_business_id uuid,p_requested_amount numeric default null)
returns jsonb
language plpgsql
security invoker
set search_path=public
as $function$
declare
  revenue numeric;
  profit numeric;
  debt numeric;
  debt_service numeric;
  score numeric := 0;
  strengths jsonb := '[]'::jsonb;
  gaps jsonb := '[]'::jsonb;
  requested numeric := coalesce(p_requested_amount,0);
begin
  if not exists(select 1 from public.businesses where id=p_business_id and owner_id=(select auth.uid())) then raise exception 'Not authorized'; end if;

  select coalesce(sum(case when direction='inflow' then coalesce(base_amount,amount) else 0 end),0),
         coalesce(sum(case when direction='inflow' then coalesce(base_amount,amount) else -coalesce(base_amount,amount) end),0)
    into revenue,profit
    from public.financial_transactions
   where business_id=p_business_id and occurred_at >= now()-interval '12 months' and status='posted';

  select coalesce(sum(amount),0),coalesce(sum(amount)/12,0) into debt,debt_service
    from public.financial_transactions
   where business_id=p_business_id and direction='outflow' and occurred_at >= now()-interval '12 months' and status='posted'
     and lower(coalesce(description,'')) similar to '%(loan|debt|repayment)%';

  if revenue>0 then score:=score+25; strengths:=strengths||jsonb_build_array('Documented transaction activity exists.'); else gaps:=gaps||jsonb_build_array('More documented revenue history is needed.'); end if;
  if profit>0 then score:=score+25; strengths:=strengths||jsonb_build_array('Recorded 12-month net operating flow is positive.'); else gaps:=gaps||jsonb_build_array('Recorded operating flow is not yet positive.'); end if;
  if debt_service<=greatest(revenue/12,1)*0.35 then score:=score+20; strengths:=strengths||jsonb_build_array('Recorded debt-service burden is within a conservative threshold.'); else gaps:=gaps||jsonb_build_array('Debt-service burden should be reviewed.'); end if;
  if requested>0 and revenue>=requested*1.5 then score:=score+20; else gaps:=gaps||jsonb_build_array('Requested funding should be matched to documented business capacity.'); end if;
  if exists(select 1 from public.invoices where business_id=p_business_id and status in ('paid','sent')) then score:=score+10; strengths:=strengths||jsonb_build_array('Invoice activity supports a documented sales trail.'); else gaps:=gaps||jsonb_build_array('More invoicing history could strengthen the financing file.'); end if;

  return jsonb_build_object('score',round(score,2),'band',case when score>=80 then 'strong' when score>=60 then 'developing' else 'needs_work' end,'annual_documented_inflow',revenue,'documented_net_flow',profit,'estimated_monthly_debt_service',debt_service,'existing_debt_signal',debt,'requested_amount',requested,'strengths',strengths,'gaps',gaps);
end
$function$;

revoke all on function public.calculate_financing_readiness(uuid,numeric) from anon;
grant execute on function public.calculate_financing_readiness(uuid,numeric) to authenticated;