-- Thrift/ajo, business credit, successor access and compliance calendar.
create table if not exists public.thrift_groups (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  contribution_amount numeric(20,6) not null check(contribution_amount > 0),
  currency text not null,
  frequency text not null default 'monthly' check(frequency in ('weekly','monthly','quarterly')),
  payout_method text not null default 'rotating' check(payout_method in ('rotating','fixed','auction','custom')),
  next_contribution_date date,
  status text not null default 'draft' check(status in ('draft','active','paused','completed','cancelled')),
  rules text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.thrift_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.thrift_groups(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  payout_position integer,
  status text not null default 'active' check(status in ('active','paused','exited')),
  joined_at timestamptz not null default now()
);
create index if not exists thrift_members_group_idx on public.thrift_members(group_id,status,payout_position);
create table if not exists public.thrift_contributions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.thrift_groups(id) on delete cascade,
  member_id uuid not null references public.thrift_members(id) on delete restrict,
  period_date date not null,
  expected_amount numeric(20,6) not null,
  paid_amount numeric(20,6) not null default 0,
  currency text not null,
  status text not null default 'due' check(status in ('due','partial','paid','late','waived')),
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  unique(group_id,member_id,period_date)
);
create table if not exists public.business_credit_profiles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  score numeric(8,4) not null default 0,
  score_band text not null default 'new' check(score_band in ('new','building','established','strong')),
  payment_history_score numeric(8,4) not null default 0,
  cashflow_score numeric(8,4) not null default 0,
  invoice_history_score numeric(8,4) not null default 0,
  debt_burden_score numeric(8,4) not null default 0,
  documentation_score numeric(8,4) not null default 0,
  evidence jsonb not null default '{}'::jsonb,
  improvement_actions jsonb not null default '[]'::jsonb,
  last_calculated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(business_id)
);
create table if not exists public.successor_access_grants (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  recipient_email text not null,
  recipient_name text,
  role text not null default 'successor' check(role in ('successor','emergency_admin','accountant','trusted_operator')),
  permissions jsonb not null default '[]'::jsonb,
  activation_delay_hours integer not null default 24 check(activation_delay_hours between 0 and 720),
  emergency_reason_required boolean not null default true,
  status text not null default 'draft' check(status in ('draft','invited','pending_activation','active','revoked','expired')),
  activated_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists successor_access_business_status_idx on public.successor_access_grants(business_id,status);
create table if not exists public.compliance_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  authority text,
  category text not null default 'general',
  jurisdiction text,
  due_date date,
  recurrence text not null default 'once' check(recurrence in ('once','monthly','quarterly','half_yearly','yearly')),
  status text not null default 'open' check(status in ('open','in_progress','submitted','completed','overdue','not_applicable')),
  priority text not null default 'normal' check(priority in ('low','normal','high','critical')),
  owner_email text,
  reference_url text,
  evidence_required boolean not null default true,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists compliance_items_due_idx on public.compliance_items(business_id,status,due_date);
create index if not exists compliance_items_category_idx on public.compliance_items(business_id,category,jurisdiction);
alter table public.thrift_groups enable row level security;
alter table public.thrift_members enable row level security;
alter table public.thrift_contributions enable row level security;
alter table public.business_credit_profiles enable row level security;
alter table public.successor_access_grants enable row level security;
alter table public.compliance_items enable row level security;
drop policy if exists thrift_groups_owner_all on public.thrift_groups;
create policy thrift_groups_owner_all on public.thrift_groups for all to authenticated using(exists(select 1 from public.businesses b where b.id=thrift_groups.business_id and b.owner_id=(select auth.uid()))) with check(exists(select 1 from public.businesses b where b.id=thrift_groups.business_id and b.owner_id=(select auth.uid())));
drop policy if exists thrift_members_owner_all on public.thrift_members;
create policy thrift_members_owner_all on public.thrift_members for all to authenticated using(exists(select 1 from public.thrift_groups g join public.businesses b on b.id=g.business_id where g.id=thrift_members.group_id and b.owner_id=(select auth.uid()))) with check(exists(select 1 from public.thrift_groups g join public.businesses b on b.id=g.business_id where g.id=thrift_members.group_id and b.owner_id=(select auth.uid())));
drop policy if exists thrift_contributions_owner_all on public.thrift_contributions;
create policy thrift_contributions_owner_all on public.thrift_contributions for all to authenticated using(exists(select 1 from public.thrift_groups g join public.businesses b on b.id=g.business_id where g.id=thrift_contributions.group_id and b.owner_id=(select auth.uid()))) with check(exists(select 1 from public.thrift_groups g join public.businesses b on b.id=g.business_id where g.id=thrift_contributions.group_id and b.owner_id=(select auth.uid())));
drop policy if exists business_credit_profiles_owner_all on public.business_credit_profiles;
create policy business_credit_profiles_owner_all on public.business_credit_profiles for all to authenticated using(exists(select 1 from public.businesses b where b.id=business_credit_profiles.business_id and b.owner_id=(select auth.uid()))) with check(exists(select 1 from public.businesses b where b.id=business_credit_profiles.business_id and b.owner_id=(select auth.uid())));
drop policy if exists successor_access_owner_all on public.successor_access_grants;
create policy successor_access_owner_all on public.successor_access_grants for all to authenticated using(exists(select 1 from public.businesses b where b.id=successor_access_grants.business_id and b.owner_id=(select auth.uid()))) with check(exists(select 1 from public.businesses b where b.id=successor_access_grants.business_id and b.owner_id=(select auth.uid())));
drop policy if exists compliance_items_owner_all on public.compliance_items;
create policy compliance_items_owner_all on public.compliance_items for all to authenticated using(exists(select 1 from public.businesses b where b.id=compliance_items.business_id and b.owner_id=(select auth.uid()))) with check(exists(select 1 from public.businesses b where b.id=compliance_items.business_id and b.owner_id=(select auth.uid())));
create or replace function public.calculate_business_credit_score(p_business_id uuid)
returns jsonb language plpgsql security invoker set search_path=public
as $function$
declare paid integer; total integer; inflow numeric; outflow numeric; invoiceCount integer; daysActive integer; score numeric:=0; paymentScore numeric:=0; cashScore numeric:=0; invoiceScore numeric:=0; debtScore numeric:=0; documentationScore numeric:=0; actions jsonb:='[]'::jsonb; evidence jsonb:='{}'::jsonb;
begin
 if not exists(select 1 from public.businesses where id=p_business_id and owner_id=(select auth.uid())) then raise exception 'Not authorized'; end if;
 select count(*) filter(where status='paid'),count(*) into paid,total from public.invoices where business_id=p_business_id;
 paymentScore:=case when total=0 then 0 else least(100,(paid::numeric/total::numeric)*100) end;
 select coalesce(sum(case when direction='inflow' then coalesce(base_amount,amount) else 0 end),0),coalesce(sum(case when direction='outflow' then coalesce(base_amount,amount) else 0 end),0) into inflow,outflow from public.financial_transactions where business_id=p_business_id and occurred_at>=now()-interval '12 months' and status='posted';
 cashScore:=case when inflow<=0 then 0 else greatest(0,least(100,(1-(outflow/greatest(inflow,1)))*100)) end;
 select count(*) into invoiceCount from public.invoices where business_id=p_business_id;
 invoiceScore:=least(100,invoiceCount*10);
 debtScore:=greatest(0,100-least(100,(outflow/greatest(inflow,1))*100));
 select extract(day from now()-min(created_at))::integer into daysActive from public.invoices where business_id=p_business_id;
 documentationScore:=least(100,(case when invoiceCount>0 then 50 else 0 end)+(case when inflow>0 then 50 else 0 end));
 score:=round(paymentScore*.25+cashScore*.25+invoiceScore*.2+debtScore*.15+documentationScore*.15,2);
 actions:=case when score<60 then jsonb_build_array('Build a longer documented payment history.','Maintain consistent business transaction records.','Reduce overdue or unexplained liabilities where possible.') else jsonb_build_array('Keep payment history consistent.','Maintain current financial documentation.','Continue recording invoices and cashflow consistently.') end;
 evidence:=jsonb_build_object('paidInvoices',paid,'invoiceCount',total,'documentedInflow',inflow,'documentedOutflow',outflow,'invoiceHistoryCount',invoiceCount,'daysWithDocumentedInvoiceHistory',coalesce(daysActive,0));
 return jsonb_build_object('score',score,'band',case when score>=80 then 'strong' when score>=60 then 'established' when score>0 then 'building' else 'new' end,'paymentHistoryScore',paymentScore,'cashflowScore',cashScore,'invoiceHistoryScore',invoiceScore,'debtBurdenScore',debtScore,'documentationScore',documentationScore,'evidence',evidence,'improvementActions',actions);
end
$function$;
revoke all on function public.calculate_business_credit_score(uuid) from anon;
grant execute on function public.calculate_business_credit_score(uuid) to authenticated;