-- Proactive cash-flow alerts, WhatsApp order capture, and voice-of-customer intelligence.
create table if not exists public.cashflow_alert_rules (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses(id) on delete cascade,
  horizon_days integer not null default 14 check (horizon_days between 1 and 90),
  minimum_buffer numeric not null default 0 check (minimum_buffer >= 0),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.cashflow_alerts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  rule_id uuid references public.cashflow_alert_rules(id) on delete set null,
  severity text not null check (severity in ('info','warning','critical')),
  projected_balance numeric not null,
  projected_shortfall numeric not null default 0,
  horizon_days integer not null,
  explanation text not null,
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open','acknowledged','resolved')),
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz
);
create index if not exists cashflow_alerts_business_created_idx on public.cashflow_alerts(business_id,created_at desc);

create table if not exists public.whatsapp_order_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  sender text not null,
  message_text text not null,
  parsed_items jsonb not null default '[]'::jsonb,
  order_id uuid references public.kitchen_orders(id) on delete set null,
  status text not null default 'received' check (status in ('received','parsed','ordered','needs_review','rejected')),
  created_at timestamptz not null default now()
);
create index if not exists whatsapp_order_events_business_created_idx on public.whatsapp_order_events(business_id,created_at desc);

create table if not exists public.customer_feedback (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  channel text not null check (channel in ('review','whatsapp','email','sms','chat','support','manual')),
  source_ref text,
  rating numeric check (rating between 0 and 5),
  message text not null,
  sentiment text check (sentiment in ('positive','neutral','negative','mixed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists customer_feedback_business_created_idx on public.customer_feedback(business_id,created_at desc);

create table if not exists public.customer_feedback_topics (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  topic text not null,
  feedback_count integer not null default 0,
  negative_count integer not null default 0,
  positive_count integer not null default 0,
  example_feedback_id uuid references public.customer_feedback(id) on delete set null,
  last_seen_at timestamptz not null default now(),
  unique (business_id,topic)
);
create index if not exists customer_feedback_topics_business_idx on public.customer_feedback_topics(business_id,feedback_count desc);

alter table public.cashflow_alert_rules enable row level security;
alter table public.cashflow_alerts enable row level security;
alter table public.whatsapp_order_events enable row level security;
alter table public.customer_feedback enable row level security;
alter table public.customer_feedback_topics enable row level security;

grant select,insert,update,delete on public.cashflow_alert_rules,public.cashflow_alerts,public.whatsapp_order_events,public.customer_feedback,public.customer_feedback_topics to authenticated;

create policy cashflow_alert_rules_owner_all on public.cashflow_alert_rules for all to authenticated
using (exists(select 1 from public.businesses b where b.id=cashflow_alert_rules.business_id and b.owner_id=(select auth.uid())))
with check (exists(select 1 from public.businesses b where b.id=cashflow_alert_rules.business_id and b.owner_id=(select auth.uid())));
create policy cashflow_alerts_owner_all on public.cashflow_alerts for all to authenticated
using (exists(select 1 from public.businesses b where b.id=cashflow_alerts.business_id and b.owner_id=(select auth.uid())))
with check (exists(select 1 from public.businesses b where b.id=cashflow_alerts.business_id and b.owner_id=(select auth.uid())));
create policy whatsapp_order_events_owner_all on public.whatsapp_order_events for all to authenticated
using (exists(select 1 from public.businesses b where b.id=whatsapp_order_events.business_id and b.owner_id=(select auth.uid())))
with check (exists(select 1 from public.businesses b where b.id=whatsapp_order_events.business_id and b.owner_id=(select auth.uid())));
create policy customer_feedback_owner_all on public.customer_feedback for all to authenticated
using (exists(select 1 from public.businesses b where b.id=customer_feedback.business_id and b.owner_id=(select auth.uid())))
with check (exists(select 1 from public.businesses b where b.id=customer_feedback.business_id and b.owner_id=(select auth.uid())));
create policy customer_feedback_topics_owner_all on public.customer_feedback_topics for all to authenticated
using (exists(select 1 from public.businesses b where b.id=customer_feedback_topics.business_id and b.owner_id=(select auth.uid())))
with check (exists(select 1 from public.businesses b where b.id=customer_feedback_topics.business_id and b.owner_id=(select auth.uid())));

insert into public.cashflow_alert_rules (business_id)
select id from public.businesses
on conflict (business_id) do nothing;
