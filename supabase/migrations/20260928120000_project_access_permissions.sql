-- Project/Builder authorization bridge.
-- Uses the existing business membership model when present, with owner fallback.
create or replace function public.user_can_business(
  p_business_id uuid,
  p_user_id uuid,
  p_permission text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  member_role text;
begin
  if p_business_id is null or p_user_id is null then return false; end if;
  select b.owner_id into owner_id from public.businesses b where b.id = p_business_id;
  if owner_id = p_user_id then return true; end if;

  begin
    select wm.role::text into member_role
    from public.workspace_members wm
    join public.workspaces w on w.id = wm.workspace_id
    where w.business_id = p_business_id
      and wm.user_id = p_user_id
      and coalesce(wm.status, 'active') = 'active'
    limit 1;
  exception when undefined_table then
    member_role := null;
  end;

  if member_role is null then return false; end if;
  if member_role in ('owner','admin','manager') then return true; end if;
  if p_permission in ('read_projects','read_project_files','read_project_history','read_deployments') and member_role in ('member','staff','viewer','developer') then return true; end if;
  if p_permission in ('write_project_files','run_project_runtime','create_projects','snapshot_projects') and member_role in ('member','staff','developer') then return true; end if;
  if p_permission in ('deploy_projects') and member_role in ('owner','admin','manager','developer') then return true; end if;
  return false;
end;
$$;

grant execute on function public.user_can_business(uuid,uuid,text) to authenticated;
