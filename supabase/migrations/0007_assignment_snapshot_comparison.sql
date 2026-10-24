-- Apply in the SQL editor after 0006. Retains the older server-only RPC during rollout.
begin;

-- A revision is an exact concurrency token; decimal JSON may round raw floats.
alter table public.pressure_snapshots add column if not exists revision bigint not null default 0;
create or replace function public.advance_pressure_snapshot_revision()
returns trigger language plpgsql set search_path = '' as $$
begin
  if TG_OP = 'INSERT' then new.revision := 0;
  else new.revision := old.revision + 1;
  end if;
  return new;
end;
$$;
create or replace trigger pressure_snapshot_revision before insert or update on public.pressure_snapshots
  for each row execute function public.advance_pressure_snapshot_revision();


-- Service-role only: the authenticated HTTP route checks lead access first.
-- Engine math remains in TypeScript. Locked, compared snapshots prevent stale
-- calculations from overwriting a concurrent sync or another assignment.
create or replace function public.post_team_assignment(
  p_team_id uuid, p_created_by uuid, p_title text, p_due timestamptz,
  p_size public.task_size, p_client_key uuid, p_changes jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  assignment_id uuid;
  change jsonb;
  snapshot public.pressure_snapshots%rowtype;
  expected_ids uuid[];
  supplied_ids uuid[];
begin
  -- Keep membership and lead authorization stable through the commit.
  perform 1 from public.memberships where team_id = p_team_id order by user_id for share;
  if not exists (select 1 from public.memberships
    where team_id = p_team_id and user_id = p_created_by and role = 'lead') then
    raise exception 'Lead access required' using errcode = '42501';
  end if;

  insert into public.team_assignments(team_id, title, due_at, size, created_by, client_key)
    values (p_team_id, p_title, p_due, p_size, p_created_by, p_client_key)
    on conflict (team_id, client_key) do nothing returning id into assignment_id;
  if assignment_id is null then
    select id into assignment_id from public.team_assignments where team_id = p_team_id and client_key = p_client_key;
    return jsonb_build_object('assignmentId', assignment_id, 'duplicate', true);
  end if;

  select coalesce(array_agg(user_id order by user_id), '{}'::uuid[]) into expected_ids
    from public.memberships where team_id = p_team_id and role <> 'lead';
  select coalesce(array_agg((c->>'user_id')::uuid order by (c->>'user_id')::uuid), '{}'::uuid[]) into supplied_ids
    from jsonb_array_elements(p_changes) c;
  if expected_ids is distinct from supplied_ids then
    raise exception 'Assignment recipients changed; retry' using errcode = '40001';
  end if;

  -- Global user order also prevents deadlocks when two teams share recipients.
  for change in select c from jsonb_array_elements(p_changes) c order by (c->>'user_id')::uuid loop
    select * into snapshot from public.pressure_snapshots where user_id = (change->>'user_id')::uuid for update;
    if found then
      if change->'before' = 'null'::jsonb
        or snapshot.revision is distinct from (change->'before'->>'revision')::bigint then
        raise exception 'Assignment snapshot changed; retry' using errcode = '40001';
      end if;
      update public.pressure_snapshots set
        raw = (change->'after'->>'raw')::double precision,
        score = (change->'after'->>'score')::integer,
        zone = (change->'after'->>'zone')::public.zone,
        counts = change->'after'->'counts'
      where user_id = snapshot.user_id;
      -- computed_at and forecast retain their original values.
    elsif change->'before' <> 'null'::jsonb then
      raise exception 'Assignment snapshot changed; retry' using errcode = '40001';
    end if;

    insert into public.tasks(owner_id, title, due_at, size, source, assignment_id)
      values ((change->>'user_id')::uuid, p_title, p_due, p_size, 'team', assignment_id);
  end loop;
  return jsonb_build_object('assignmentId', assignment_id, 'duplicate', false);
end;
$$;

revoke all on function public.post_team_assignment(uuid, uuid, text, timestamptz, public.task_size, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.post_team_assignment(uuid, uuid, text, timestamptz, public.task_size, uuid, jsonb) to service_role;
commit;
