-- Persistent AI Builder attachment/reference library.
-- Attachments are private business-owned inputs that can be reused by conversations/projects.
create table if not exists public.ai_builder_attachments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  conversation_id uuid references public.ai_conversations(id) on delete set null,
  project_id uuid references public.ai_projects(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  original_name text not null,
  storage_path text not null unique,
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  kind text not null check (kind in ('image','document','spreadsheet','text','archive','other')),
  status text not null default 'processing' check (status in ('processing','ready','failed')),
  extracted_text text,
  width integer,
  height integer,
  metadata jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_builder_attachments_business_idx
  on public.ai_builder_attachments(business_id, created_at desc);
create index if not exists ai_builder_attachments_conversation_idx
  on public.ai_builder_attachments(conversation_id, created_at desc);
create index if not exists ai_builder_attachments_project_idx
  on public.ai_builder_attachments(project_id, created_at desc);

alter table public.ai_builder_attachments enable row level security;

drop policy if exists ai_builder_attachments_owner_all on public.ai_builder_attachments;
create policy ai_builder_attachments_owner_all
on public.ai_builder_attachments
for all to authenticated
using (
  exists (
    select 1
    from public.businesses b
    where b.id = ai_builder_attachments.business_id
      and b.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.businesses b
    where b.id = ai_builder_attachments.business_id
      and b.owner_id = (select auth.uid())
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bizstack-ai-attachments',
  'bizstack-ai-attachments',
  false,
  15728640,
  array[
    'image/png','image/jpeg','image/webp','image/gif','image/svg+xml',
    'application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel','text/plain','text/markdown','text/csv',
    'application/json','text/html','application/xml','text/xml','application/octet-stream'
  ]::text[]
)
on conflict (id) do update
set file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types,
    public = false;

drop policy if exists bizstack_ai_attachments_insert on storage.objects;
create policy bizstack_ai_attachments_insert
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'bizstack-ai-attachments'
  and exists (
    select 1
    from public.ai_builder_attachments a
    join public.businesses b on b.id = a.business_id
    where a.storage_path = storage.objects.name
      and b.owner_id = (select auth.uid())
  )
);

drop policy if exists bizstack_ai_attachments_select on storage.objects;
create policy bizstack_ai_attachments_select
on storage.objects
for select to authenticated
using (
  bucket_id = 'bizstack-ai-attachments'
  and exists (
    select 1
    from public.ai_builder_attachments a
    join public.businesses b on b.id = a.business_id
    where a.storage_path = storage.objects.name
      and b.owner_id = (select auth.uid())
  )
);

drop policy if exists bizstack_ai_attachments_update on storage.objects;
create policy bizstack_ai_attachments_update
on storage.objects
for update to authenticated
using (
  bucket_id = 'bizstack-ai-attachments'
  and exists (
    select 1
    from public.ai_builder_attachments a
    join public.businesses b on b.id = a.business_id
    where a.storage_path = storage.objects.name
      and b.owner_id = (select auth.uid())
  )
)
with check (
  bucket_id = 'bizstack-ai-attachments'
  and exists (
    select 1
    from public.ai_builder_attachments a
    join public.businesses b on b.id = a.business_id
    where a.storage_path = storage.objects.name
      and b.owner_id = (select auth.uid())
  )
);

drop policy if exists bizstack_ai_attachments_delete on storage.objects;
create policy bizstack_ai_attachments_delete
on storage.objects
for delete to authenticated
using (
  bucket_id = 'bizstack-ai-attachments'
  and exists (
    select 1
    from public.ai_builder_attachments a
    join public.businesses b on b.id = a.business_id
    where a.storage_path = storage.objects.name
      and b.owner_id = (select auth.uid())
  )
);
