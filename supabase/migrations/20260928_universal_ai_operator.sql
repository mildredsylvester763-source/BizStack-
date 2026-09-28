create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  agent_id uuid references public.ai_agents(id) on delete set null,
  title text not null default 'New conversation',
  status text not null default 'active' check (status in ('active','archived')),
  metadata jsonb not null default '{}'::jsonb,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  sender_user_id uuid references auth.users(id) on delete set null,
  role text not null check (role in ('system','user','assistant','tool')),
  content text not null default '',
  tool_name text,
  tool_call_id text,
  metadata jsonb not null default '{}'::jsonb,
  client_message_id text,
  created_at timestamptz not null default now()
);

create unique index if not exists ai_messages_client_message_idx on public.ai_messages(conversation_id,client_message_id) where client_message_id is not null;
create index if not exists ai_conversations_business_last_message_idx on public.ai_conversations(business_id,last_message_at desc);
create index if not exists ai_messages_conversation_created_idx on public.ai_messages(conversation_id,created_at);

alter table public.ai_agent_runs add column if not exists conversation_id uuid references public.ai_conversations(id) on delete set null;
create index if not exists ai_agent_runs_conversation_idx on public.ai_agent_runs(conversation_id,created_at desc);

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;

drop policy if exists ai_conversations_owner_select on public.ai_conversations;
drop policy if exists ai_conversations_owner_insert on public.ai_conversations;
drop policy if exists ai_conversations_owner_update on public.ai_conversations;
drop policy if exists ai_conversations_owner_delete on public.ai_conversations;

create policy ai_conversations_owner_select on public.ai_conversations for select to authenticated using (exists (select 1 from public.businesses b where b.id=ai_conversations.business_id and b.owner_id=(select auth.uid())));
create policy ai_conversations_owner_insert on public.ai_conversations for insert to authenticated with check (exists (select 1 from public.businesses b where b.id=ai_conversations.business_id and b.owner_id=(select auth.uid())) and created_by=(select auth.uid()));
create policy ai_conversations_owner_update on public.ai_conversations for update to authenticated using (exists (select 1 from public.businesses b where b.id=ai_conversations.business_id and b.owner_id=(select auth.uid()))) with check (exists (select 1 from public.businesses b where b.id=ai_conversations.business_id and b.owner_id=(select auth.uid())));
create policy ai_conversations_owner_delete on public.ai_conversations for delete to authenticated using (exists (select 1 from public.businesses b where b.id=ai_conversations.business_id and b.owner_id=(select auth.uid())));

drop policy if exists ai_messages_owner_select on public.ai_messages;
drop policy if exists ai_messages_owner_insert on public.ai_messages;
drop policy if exists ai_messages_owner_update on public.ai_messages;
drop policy if exists ai_messages_owner_delete on public.ai_messages;

create policy ai_messages_owner_select on public.ai_messages for select to authenticated using (exists (select 1 from public.ai_conversations c join public.businesses b on b.id=c.business_id where c.id=ai_messages.conversation_id and b.owner_id=(select auth.uid())));
create policy ai_messages_owner_insert on public.ai_messages for insert to authenticated with check (exists (select 1 from public.ai_conversations c join public.businesses b on b.id=c.business_id where c.id=ai_messages.conversation_id and b.owner_id=(select auth.uid())));
create policy ai_messages_owner_update on public.ai_messages for update to authenticated using (exists (select 1 from public.ai_conversations c join public.businesses b on b.id=c.business_id where c.id=ai_messages.conversation_id and b.owner_id=(select auth.uid()))) with check (exists (select 1 from public.ai_conversations c join public.businesses b on b.id=c.business_id where c.id=ai_messages.conversation_id and b.owner_id=(select auth.uid())));
create policy ai_messages_owner_delete on public.ai_messages for delete to authenticated using (exists (select 1 from public.ai_conversations c join public.businesses b on b.id=c.business_id where c.id=ai_messages.conversation_id and b.owner_id=(select auth.uid())));

grant select,insert,update,delete on public.ai_conversations to authenticated;
grant select,insert,update,delete on public.ai_messages to authenticated;

insert into public.ai_tools (tool_key,name,description,category,risk_level,input_schema,output_schema,capabilities,status)
values
('customers.create','Create Customer','Create a real customer record after checking likely duplicates.','crm','low','{"type":"object","properties":{"name":{"type":"string"},"company_name":{"type":"string"},"email":{"type":"string"},"phone":{"type":"string"},"country":{"type":"string"},"customer_type":{"type":"string"}},"required":["name"]}','{"type":"object"}','["write","crm","audit"]','active'),
('products.create','Create Product','Create a real catalog product with price, cost and opening stock when requested.','inventory','low','{"type":"object","properties":{"name":{"type":"string"},"sku":{"type":"string"},"unit_price":{"type":"number"},"cost_price":{"type":"number"},"stock_quantity":{"type":"number"},"low_stock_threshold":{"type":"number"}},"required":["name"]}','{"type":"object"}','["write","inventory","audit"]','active'),
('website.build','Build Website','Create or modify a real BizStack website from a natural-language request.','website','medium','{"type":"object","properties":{"prompt":{"type":"string"},"website_id":{"type":"string"}},"required":["prompt"]}','{"type":"object"}','["write","website","design","audit"]','active'),
('integrations.list','Inspect Connections','Inspect real integrations and their current connection status.','integrations','low','{"type":"object","properties":{}}','{"type":"array"}','["read","integrations"]','active'),
('wallet.summary','Wallet Summary','Read wallet balances and recent financial activity.','money','low','{"type":"object","properties":{}}','{"type":"object"}','["read","finance"]','active')
on conflict (tool_key) do update set name=excluded.name,description=excluded.description,category=excluded.category,risk_level=excluded.risk_level,input_schema=excluded.input_schema,output_schema=excluded.output_schema,capabilities=excluded.capabilities,status=excluded.status;

insert into public.ai_agents (business_id,name,slug,role,description,status,autonomy_mode,system_config,tools,permissions,triggers,memory_config)
select b.id,'BizStack Operator','bizstack-operator','general_operations','Universal autonomous business operator for conversations, business tasks, connected services and cross-module workflows.','active','auto_execute','{"approval_policy":{"critical_always":true,"high_default":true},"max_tool_steps":8}'::jsonb,'[]'::jsonb,'["read_business_context","read_customers","read_invoices","read_inventory","read_money","read_integrations","read_wallet","draft_actions","create_customers","create_invoices","create_products","build_websites"]'::jsonb,'["chat","voice","manual","event"]'::jsonb,'{"enabled":true,"retain_runtime_memory":true}'::jsonb
from public.businesses b
where not exists (select 1 from public.ai_agents a where a.business_id=b.id and a.slug='bizstack-operator');

insert into public.ai_agent_tool_bindings (business_id,agent_id,tool_id,enabled,configuration)
select b.id,a.id,t.id,true,'{}'::jsonb
from public.businesses b join public.ai_agents a on a.business_id=b.id and a.slug='bizstack-operator'
join public.ai_tools t on t.status='active'
where not exists (select 1 from public.ai_agent_tool_bindings x where x.business_id=b.id and x.agent_id=a.id and x.tool_id=t.id);
