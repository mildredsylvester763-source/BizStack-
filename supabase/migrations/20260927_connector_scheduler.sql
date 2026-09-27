-- Connector schedule claiming for an external scheduler/worker.
create or replace function public.claim_connector_schedules(p_limit integer default 20)
returns table(
  id uuid,
  business_id uuid,
  connector_definition_id uuid,
  resource text,
  interval_seconds integer,
  config jsonb,
  claimed_at timestamptz
)
language plpgsql
security definer
set search_path=public
as $function$
begin
  return query
  with picked as (
    select s.id
    from public.connector_schedules s
    where s.enabled=true
      and s.next_run_at is not null
      and s.next_run_at <= now()
      and coalesce(s.last_status,'') <> 'running'
    order by s.next_run_at asc
    for update skip locked
    limit greatest(1,least(coalesce(p_limit,20),100))
  )
  update public.connector_schedules s
  set last_run_at=now(),
      last_status='running',
      next_run_at=case when coalesce(s.interval_seconds,0)>0 then now() + make_interval(secs => s.interval_seconds) else null end,
      updated_at=now()
  from picked
  where s.id=picked.id
  returning s.id,s.business_id,s.connector_definition_id,s.resource,s.interval_seconds,s.config,now();
end
$function$;

revoke all on function public.claim_connector_schedules(integer) from public;
grant execute on function public.claim_connector_schedules(integer) to service_role;
