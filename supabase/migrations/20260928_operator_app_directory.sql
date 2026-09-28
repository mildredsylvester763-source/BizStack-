-- Operator app directory and account-aware connection metadata.
create table if not exists public.ai_app_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  publisher text,
  category text not null,
  description text not null default '',
  icon_key text not null default 'app',
  auth_type text not null default 'oauth',
  connection_mode text not null default 'account',
  capabilities jsonb not null default '[]'::jsonb,
  scopes jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('active','coming_soon','private')),
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.integrations add column if not exists account_label text;
alter table public.integrations add column if not exists external_account_id text;
alter table public.integrations add column if not exists external_account_email text;
alter table public.integrations add column if not exists external_account_name text;
alter table public.integrations add column if not exists last_verified_at timestamptz;
alter table public.integrations add column if not exists last_used_at timestamptz;
alter table public.integrations add column if not exists permission_state jsonb not null default '{}'::jsonb;
alter table public.integrations add column if not exists action_policy jsonb not null default '{"read":true,"write":false,"delete":false,"share":false}'::jsonb;

create index if not exists integrations_business_provider_status_idx on public.integrations(business_id,provider,status);
create index if not exists integrations_external_account_idx on public.integrations(provider,external_account_id) where external_account_id is not null;

alter table public.ai_app_catalog enable row level security;
grant select on public.ai_app_catalog to authenticated;

drop policy if exists ai_app_catalog_read on public.ai_app_catalog;
create policy ai_app_catalog_read on public.ai_app_catalog for select to authenticated using (status <> 'private' or exists (
  select 1 from public.businesses b where b.owner_id=auth.uid()
));

insert into public.ai_app_catalog
(slug,name,publisher,category,description,icon_key,auth_type,connection_mode,capabilities,scopes,status,sort_order)
values
('google-drive','Google Drive','Google','Files','Search and work with Drive files, folders, Docs, Sheets and Slides from the Operator.','google-drive','oauth','account','["search","read","create","update","move"]','["drive.metadata.readonly","drive.readonly","drive.file"]','active',10),
('github','GitHub','GitHub','Developer','Repositories, branches, source files, issues, pull requests and code workflows.','github','oauth','account','["search","read","write","branches","pull_requests","issues","webhooks"]','["repo","read:user","user:email"]','active',20),
('gmail','Gmail','Google','Communication','Search, summarize, draft and send business email through the connected Google account.','gmail','oauth','account','["search","read","draft","send"]','["gmail.readonly","gmail.modify","gmail.send"]','active',30),
('google-calendar','Google Calendar','Google','Scheduling','Read calendars, find availability and manage authorized business events.','google-calendar','oauth','account','["search","read","create","update"]','["calendar.readonly","calendar.events"]','active',40),
('slack','Slack','Slack','Communication','Search team conversations and send authorized operational messages.','slack','oauth','account','["search","read","send","channels"]','["channels:read","chat:write","search:read"]','active',50),
('notion','Notion','Notion','Knowledge','Search pages and databases and use selected workspace knowledge as context.','notion','oauth','account','["search","read","write"]','["read_content","update_content"]','active',60),
('supabase','Supabase','Supabase','Infrastructure','Inspect connected projects and operate authorized database and backend resources.','supabase','api_key','project','["read","sql","schema","logs"]','["project.read","database.read"]','active',70),
('vercel','Vercel','Vercel','Deployment','Inspect deployments, logs, projects and authorized deployment workflows.','vercel','oauth','account','["projects","deployments","logs","domains"]','["projects.read","deployments.read"]','active',80),
('dropbox','Dropbox','Dropbox','Files','Search and reference authorized Dropbox files and folders.','dropbox','oauth','account','["search","read","write"]','["files.content.read","files.content.write"]','active',90),
('onedrive','OneDrive','Microsoft','Files','Work with authorized OneDrive and Microsoft 365 files.','onedrive','oauth','account','["search","read","write"]','["Files.Read","Files.ReadWrite"]','active',100),
('outlook','Outlook','Microsoft','Communication','Search and work with authorized Outlook mail.','outlook','oauth','account','["search","read","draft","send"]','["Mail.Read","Mail.Send"]','active',110),
('whatsapp-business','WhatsApp Business','Meta','Communication','Capture customer conversations and authorized business messaging workflows.','whatsapp','oauth','business','["messages","templates","webhooks"]','["messages"]','active',120),
('stripe','Stripe','Stripe','Payments','Inspect authorized payment, customer, invoice and payout data.','stripe','api_key','account','["payments","customers","invoices","payouts","webhooks"]','["read","write"]','active',130),
('shopify','Shopify','Shopify','Commerce','Connect a store for orders, products, customers and inventory workflows.','shopify','oauth','store','["orders","products","customers","inventory","webhooks"]','["read_orders","read_products","read_customers"]','active',140),
('quickbooks','QuickBooks','Intuit','Accounting','Bring accounting context into the Operator with permission-aware access.','quickbooks','oauth','company','["accounting","customers","invoices","payments"]','["com.intuit.quickbooks.accounting"]','active',150),
('xero','Xero','Xero','Accounting','Connect accounting records for operational finance workflows.','xero','oauth','organization','["accounting","contacts","invoices","payments"]','["accounting.transactions","accounting.contacts"]','active',160),
('tavily','Tavily','Tavily','Research','Give the Operator controlled web research and search grounding.','tavily','api_key','workspace','["search","research"]','["search"]','active',170),
('firecrawl','Firecrawl','Firecrawl','Research','Extract structured web content for research and agent workflows.','firecrawl','api_key','workspace','["crawl","scrape","extract"]','["web"]','active',180),
('resend','Resend','Resend','Communication','Send transactional and workflow emails from BizStack.','resend','api_key','workspace','["send","domains","templates"]','["send"]','active',190),
('custom-connector','Custom Connector','BizStack','Custom','Connect a documented API, webhook, database or private service through a governed connector definition.','custom','custom','custom','["http","oauth","api_key","webhook","database","schema"]','[]','active',1000)
on conflict (slug) do update set
 name=excluded.name,publisher=excluded.publisher,category=excluded.category,description=excluded.description,
 icon_key=excluded.icon_key,auth_type=excluded.auth_type,connection_mode=excluded.connection_mode,
 capabilities=excluded.capabilities,scopes=excluded.scopes,status=excluded.status,sort_order=excluded.sort_order;

alter table public.integrations enable row level security;
