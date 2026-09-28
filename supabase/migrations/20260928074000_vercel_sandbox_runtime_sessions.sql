alter table public.ai_terminal_sessions
  add column if not exists sandbox_name text,
  add column if not exists sandbox_provider text not null default 'vercel_sandbox',
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.ai_preview_sessions
  add column if not exists sandbox_name text,
  add column if not exists sandbox_provider text not null default 'vercel_sandbox',
  add column if not exists dev_port integer,
  add column if not exists sandbox_domain text,
  add column if not exists started_at timestamptz,
  add column if not exists stopped_at timestamptz;

create index if not exists ai_terminal_sessions_sandbox_idx
  on public.ai_terminal_sessions(sandbox_name, created_at desc);

create index if not exists ai_preview_sessions_sandbox_idx
  on public.ai_preview_sessions(sandbox_name, created_at desc);
