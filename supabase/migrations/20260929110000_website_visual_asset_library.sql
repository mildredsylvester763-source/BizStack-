-- Website visual asset library and secure public asset storage.
create table if not exists public.ai_website_assets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  website_id uuid references public.websites(id) on delete cascade,
  project_id uuid references public.ai_projects(id) on delete cascade,
  build_run_id uuid references public.ai_build_runs(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('logo','hero','section_image','product_scene','background','illustration','og_image','favicon','custom')),
  name text not null,
  prompt text not null,
  storage_path text not null unique,
  mime_type text not null default 'image/png',
  width integer,
  height integer,
  alt_text text,
  model text,
  status text not null default 'generating' check (status in ('generating','active','failed','archived')),
  metadata jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_website_assets_business_idx on public.ai_website_assets(business_id, created_at desc);
create index if not exists ai_website_assets_website_idx on public.ai_website_assets(website_id, created_at desc);
create index if not exists ai_website_assets_project_idx on public.ai_website_assets(project_id, created_at desc);
create index if not exists ai_website_assets_status_idx on public.ai_website_assets(business_id, status, created_at desc);

alter table public.ai_website_assets enable row level security;

drop policy if exists ai_website_assets_owner_all on public.ai_website_assets;
create policy ai_website_assets_owner_all
on public.ai_website_assets
for all to authenticated
using (exists (select 1 from public.businesses b where b.id=ai_website_assets.business_id and b.owner_id=(select auth.uid())))
with check (exists (select 1 from public.businesses b where b.id=ai_website_assets.business_id and b.owner_id=(select auth.uid())));

insert into storage.buckets (id, name, public, allowed_mime_types)
values ('bizstack-website-assets','bizstack-website-assets',true,array['image/png','image/jpeg','image/webp','image/svg+xml']::text[])
on conflict (id) do update set name=excluded.name, public=true, allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists bizstack_website_assets_insert on storage.objects;
create policy bizstack_website_assets_insert on storage.objects
for insert to authenticated
with check (
  bucket_id='bizstack-website-assets'
  and exists (
    select 1 from public.ai_website_assets a
    join public.businesses b on b.id=a.business_id
    where a.storage_path=storage.objects.name
      and b.owner_id=(select auth.uid())
  )
);

drop policy if exists bizstack_website_assets_update on storage.objects;
create policy bizstack_website_assets_update on storage.objects
for update to authenticated
using (
  bucket_id='bizstack-website-assets'
  and exists (
    select 1 from public.ai_website_assets a
    join public.businesses b on b.id=a.business_id
    where a.storage_path=storage.objects.name
      and b.owner_id=(select auth.uid())
  )
)
with check (
  bucket_id='bizstack-website-assets'
  and exists (
    select 1 from public.ai_website_assets a
    join public.businesses b on b.id=a.business_id
    where a.storage_path=storage.objects.name
      and b.owner_id=(select auth.uid())
  )
);

drop policy if exists bizstack_website_assets_delete on storage.objects;
create policy bizstack_website_assets_delete on storage.objects
for delete to authenticated
using (
  bucket_id='bizstack-website-assets'
  and exists (
    select 1 from public.ai_website_assets a
    join public.businesses b on b.id=a.business_id
    where a.storage_path=storage.objects.name
      and b.owner_id=(select auth.uid())
  )
);

drop policy if exists bizstack_website_assets_select_authenticated on storage.objects;
create policy bizstack_website_assets_select_authenticated on storage.objects
for select to authenticated
using (
  bucket_id='bizstack-website-assets'
  and exists (
    select 1 from public.ai_website_assets a
    join public.businesses b on b.id=a.business_id
    where a.storage_path=storage.objects.name
      and b.owner_id=(select auth.uid())
  )
);