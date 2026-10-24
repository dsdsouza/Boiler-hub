-- Integration checks for an isolated local database with migrations 0001–0004 applied.
-- Uses synthetic users and rolls back every fixture. Do not run against a live project.
begin;
insert into auth.users (id) values
  ('10000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002'),
  ('10000000-0000-4000-8000-000000000003');
insert into public.tasks (owner_id, title, due_at, source, done_at) values
  ('10000000-0000-4000-8000-000000000001', 'Owner A task', now() + interval '1 day', 'manual', null),
  ('10000000-0000-4000-8000-000000000001', 'Owner A assignment', now() + interval '2 days', 'team', null),
  ('10000000-0000-4000-8000-000000000001', 'Completed', now() + interval '2 days', 'manual', now()),
  ('10000000-0000-4000-8000-000000000001', 'Undated', null, 'manual', null),
  ('10000000-0000-4000-8000-000000000001', 'Imported', now() + interval '1 day', 'ics', null),
  ('10000000-0000-4000-8000-000000000002', 'Owner B task', now() + interval '1 day', 'manual', null);
insert into public.calendar_subscriptions (user_id, token_hash, token_encrypted) values
  ('10000000-0000-4000-8000-000000000001', repeat('a', 64), 'synthetic encrypted token A'),
  ('10000000-0000-4000-8000-000000000002', repeat('b', 64), 'synthetic encrypted token B'),
  ('10000000-0000-4000-8000-000000000003', repeat('c', 64), 'synthetic encrypted token C');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
do $$
begin
  if (select count(*) from public.calendar_subscriptions) <> 1 then raise exception 'RLS exposed another owner'; end if;
  delete from public.calendar_subscriptions where user_id = '10000000-0000-4000-8000-000000000002';
  begin
    insert into public.calendar_subscriptions values
      ('10000000-0000-4000-8000-000000000004', repeat('d', 64), 'invalid cross-user write', now());
    raise exception 'Cross-user insert was allowed';
  exception when insufficient_privilege then null;
  end;
end;
$$;

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
do $$
declare result jsonb;
begin
  if has_table_privilege('anon', 'public.calendar_subscriptions', 'select') then raise exception 'Anonymous token-table access'; end if;
  result := public.calendar_subscription_tasks(repeat('a', 64));
  if jsonb_array_length(result->'tasks') <> 2 then raise exception 'Wrong feed scope: %', result; end if;
  if result::text like '%Owner B%' or result::text like '%token_encrypted%' or result::text like '%user_id%' then
    raise exception 'Leaked unrelated data';
  end if;
  if jsonb_array_length(public.calendar_subscription_tasks(repeat('b',64))->'tasks') <> 1 then
    raise exception 'Cross-user delete affected another owner';
  end if;
  if public.calendar_subscription_tasks(repeat('c',64)) <> '{"tasks":[]}'::jsonb then raise exception 'Invalid empty feed'; end if;
  if public.calendar_subscription_tasks(repeat('d',64)) is not null then raise exception 'Unknown token was accepted'; end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
update public.tasks set title = 'Rescheduled deadline', due_at = now() + interval '5 days' where title = 'Owner A task';
update public.tasks set done_at = now() where title = 'Owner A assignment';
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
do $$
declare result jsonb;
begin
  result := public.calendar_subscription_tasks(repeat('a',64));
  if jsonb_array_length(result->'tasks') <> 1 or result->'tasks'->0->>'title' <> 'Rescheduled deadline' then
    raise exception 'Feed failed to reflect task edits/completion: %', result;
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
delete from public.calendar_subscriptions where user_id = '10000000-0000-4000-8000-000000000001';
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
do $$
begin
  if public.calendar_subscription_tasks(repeat('a',64)) is not null then raise exception 'Revoked token still works'; end if;
  raise notice 'PASS: owner isolation, read-only scope, live updates, empty feeds, and revocation';
end;
$$;
rollback;
