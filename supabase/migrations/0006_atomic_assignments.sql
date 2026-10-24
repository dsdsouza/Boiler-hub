-- Apply by hand after 0005, before deploying the assignment API that uses it.
-- One transaction: a failed task or snapshot write cannot leave a saved draft
-- whose duplicate-key retry silently skips the remaining work.
create function public.post_team_assignment(
  p_team_id uuid, p_created_by uuid, p_title text, p_due_at timestamptz,
  p_size public.task_size, p_client_key uuid, p_targets uuid[], p_bumps jsonb
)
returns jsonb
language plpgsql volatile security invoker set search_path = ''
as $$
declare
  v_id uuid;
  v_updated integer;
begin
  if not exists (select 1 from public.memberships
    where team_id = p_team_id and user_id = p_created_by and role = 'lead') then
    raise exception 'lead membership required' using errcode = '42501';
  end if;

  insert into public.team_assignments(team_id, created_by, title, due_at, size, client_key)
  values (p_team_id, p_created_by, p_title, p_due_at, p_size, p_client_key)
  on conflict (team_id, client_key) where client_key is not null do nothing
  returning id into v_id;
  if v_id is null then
    select id into strict v_id from public.team_assignments
      where team_id = p_team_id and client_key = p_client_key;
    return jsonb_build_object('assignmentId', v_id, 'duplicate', true);
  end if;

  -- Membership may have changed since the server prepared the preview. Retry
  -- with fresh targets rather than posting to a partial or unrelated audience.
  if exists (
    (select user_id from public.memberships where team_id = p_team_id and role = 'member'
      except select unnest(p_targets))
    union all
    (select unnest(p_targets) except
      select user_id from public.memberships where team_id = p_team_id and role = 'member')
  ) then
    raise exception 'assignment recipients changed; retry' using errcode = '40001';
  end if;

  insert into public.tasks(owner_id, title, due_at, size, source, assignment_id)
  select user_id, p_title, p_due_at, p_size, 'team', v_id
  from public.memberships where team_id = p_team_id and role = 'member';

  if exists (select 1 from jsonb_to_recordset(p_bumps) as b(user_id uuid)
    where not (b.user_id = any(p_targets))) then
    raise exception 'snapshot outside assignment recipients' using errcode = '42501';
  end if;
  -- Compare the original snapshot as well as its timestamp. Concurrent posts
  -- and owner syncs must not overwrite each other's work. Preserve freshness
  -- and forecast: no calendar has been re-read by this transaction.
  update public.pressure_snapshots s
  set score = b.score, raw = b.raw, zone = b.zone, counts = b.counts
  from jsonb_to_recordset(p_bumps) as b(user_id uuid, raw_before double precision,
    score integer, raw double precision, zone public.zone, counts jsonb, computed_at timestamptz)
  where s.user_id = b.user_id and s.raw = b.raw_before and s.computed_at = b.computed_at;
  get diagnostics v_updated = row_count;
  if v_updated <> jsonb_array_length(p_bumps) then
    raise exception 'assignment snapshots changed; retry' using errcode = '40001';
  end if;

  return jsonb_build_object('assignmentId', v_id, 'duplicate', false);
end;
$$;

-- The API verifies the signed-in caller's lead role before using service_role;
-- the function checks that membership again. No client may supply score bumps.
revoke all on function public.post_team_assignment(uuid, uuid, text, timestamptz,
  public.task_size, uuid, uuid[], jsonb) from public, anon, authenticated;
grant execute on function public.post_team_assignment(uuid, uuid, text, timestamptz,
  public.task_size, uuid, uuid[], jsonb) to service_role;
