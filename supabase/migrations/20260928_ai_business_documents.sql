create table if not exists public.ai_business_documents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  document_type text not null check(document_type = any(array['business_plan','grant_draft','loan_pack','cfo_brief'])),
  title text not null,
  status text not null default 'draft' check(status = any(array['draft','review','approved','archived'])),
  version integer not null default 1,
  source_prompt text not null,
  audience text,
  funder_name text,
  content jsonb not null default '{}'::jsonb,
  assumptions jsonb not null default '[]'::jsonb,
  validation jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_business_documents_business_type_idx on public.ai_business_documents(business_id,document_type,created_at desc);
create unique index if not exists ai_business_documents_business_title_version_uidx on public.ai_business_documents(business_id,title,version);

alter table public.ai_business_documents enable row level security;
drop policy if exists ai_business_documents_owner_all on public.ai_business_documents;
create policy ai_business_documents_owner_all on public.ai_business_documents for all to authenticated
using(exists(select 1 from public.businesses b where b.id=ai_business_documents.business_id and b.owner_id=(select auth.uid())))
with check(exists(select 1 from public.businesses b where b.id=ai_business_documents.business_id and b.owner_id=(select auth.uid())));