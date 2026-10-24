-- Teams visibility tests.
-- Paste into the Supabase SQL editor and run. Everything happens in one transaction
-- that is ROLLED BACK at the end, so no test data is left behind.
-- Success: the last result is 'ALL TEAM VISIBILITY TESTS PASSED'.
-- Failure: the run stops with an error starting with 'FAIL:'.
--
-- Cast (all on team T):
--   L  lead,   visibility hidden
--   E  member, visibility everyone
--   B  member, visibility hidden
--   C  member, visibility lead (lead only)
--   X  not on the team
-- Each actor is impersonated with `set local role authenticated` plus JWT claims,
-- which is how auth.uid() and RLS see a real signed-in request.

begin;

-- ---------------------------------------------------------------------------
-- Fixtures (as the SQL editor's postgres role; the profile trigger fills profiles)
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('aaaaaaaa-0000-4000-a000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vis-l@test.local', '{"full_name":"Lead L"}'),
  ('aaaaaaaa-0000-4000-a000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vis-e@test.local', '{"full_name":"Everyone E"}'),
  ('aaaaaaaa-0000-4000-a000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vis-b@test.local', '{"full_name":"Hidden B"}'),
  ('aaaaaaaa-0000-4000-a000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vis-c@test.local', '{"full_name":"LeadOnly C"}'),
  ('aaaaaaaa-0000-4000-a000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vis-x@test.local', '{"full_name":"Outsider X"}');

insert into public.teams (id, name, type, invite_code, created_by)
values ('aaaaaaaa-0000-4000-a000-0000000000f1', 'Visibility Test', 'work', 'VZT3ST', 'aaaaaaaa-0000-4000-a000-00000000000a');

insert into public.memberships (team_id, user_id, role, visibility) values
  ('aaaaaaaa-0000-4000-a000-0000000000f1', 'aaaaaaaa-0000-4000-a000-00000000000a', 'lead',   'hidden'),
  ('aaaaaaaa-0000-4000-a000-0000000000f1', 'aaaaaaaa-0000-4000-a000-00000000000e', 'member', 'everyone'),
  ('aaaaaaaa-0000-4000-a000-0000000000f1', 'aaaaaaaa-0000-4000-a000-00000000000b', 'member', 'hidden'),
  ('aaaaaaaa-0000-4000-a000-0000000000f1', 'aaaaaaaa-0000-4000-a000-00000000000c', 'member', 'lead');

insert into public.pressure_snapshots (user_id, score, raw, zone) values
  ('aaaaaaaa-0000-4000-a000-00000000000a', 50, 17.3, 'working'),
  ('aaaaaaaa-0000-4000-a000-00000000000e', 30,  8.9, 'cool'),
  ('aaaaaaaa-0000-4000-a000-00000000000b', 95, 74.9, 'redline'),
  ('aaaaaaaa-0000-4000-a000-00000000000c', 80, 40.2, 'hot'),
  ('aaaaaaaa-0000-4000-a000-00000000000d', 10,  2.6, 'cool');

-- ---------------------------------------------------------------------------
-- As E (member): sees only self + 'everyone' members. Cannot see hidden B or lead-only C.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-a000-00000000000e","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  seen uuid[];
  n int;
begin
  select array_agg(user_id order by user_id) into seen
  from public.team_boilers('aaaaaaaa-0000-4000-a000-0000000000f1');
  if seen is distinct from array['aaaaaaaa-0000-4000-a000-00000000000e']::uuid[] then
    raise exception 'FAIL: member E should see only themself, saw %', seen;
  end if;
  if 'aaaaaaaa-0000-4000-a000-00000000000b' = any(seen) then
    raise exception 'FAIL: member saw a hidden member';
  end if;
  if 'aaaaaaaa-0000-4000-a000-00000000000c' = any(seen) then
    raise exception 'FAIL: non-lead saw a lead-only member';
  end if;

  if public.team_hidden_count('aaaaaaaa-0000-4000-a000-0000000000f1') <> 0 then
    raise exception 'FAIL: non-lead E must not receive a hidden count';
  end if;

  -- Direct table reads are owner-only.
  select count(*) into n from public.pressure_snapshots where user_id <> 'aaaaaaaa-0000-4000-a000-00000000000e';
  if n <> 0 then raise exception 'FAIL: member E read % other snapshots directly', n; end if;
  select count(*) into n from public.pressure_snapshots where user_id = 'aaaaaaaa-0000-4000-a000-00000000000b';
  if n <> 0 then raise exception 'FAIL: member E read hidden member B''s snapshot directly'; end if;
  select count(*) into n from public.memberships where team_id = 'aaaaaaaa-0000-4000-a000-0000000000f1';
  if n <> 1 then raise exception 'FAIL: member E should read only their own membership row, read %', n; end if;
  select count(*) into n from public.profiles where id <> 'aaaaaaaa-0000-4000-a000-00000000000e';
  if n <> 0 then raise exception 'FAIL: member E read % other profiles directly', n; end if;

  -- Cannot change someone else's visibility (RLS filters the row out).
  update public.memberships set visibility = 'everyone'
  where team_id = 'aaaaaaaa-0000-4000-a000-0000000000f1' and user_id = 'aaaaaaaa-0000-4000-a000-00000000000b';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: member E changed B''s visibility'; end if;

  -- Cannot promote themself (only the visibility column is granted).
  begin
    update public.memberships set role = 'lead'
    where team_id = 'aaaaaaaa-0000-4000-a000-0000000000f1' and user_id = 'aaaaaaaa-0000-4000-a000-00000000000e';
    raise exception 'FAIL: member E could update their own role';
  exception when insufficient_privilege then null;
  end;

  raise notice 'PASS: member E';
end $$;

-- ---------------------------------------------------------------------------
-- As C (member, lead-only): also a non-lead, so cannot see hidden B; sees self + E.
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-a000-00000000000c","role":"authenticated"}', true);
set local role authenticated;

do $$
declare seen uuid[];
begin
  select array_agg(user_id order by user_id) into seen
  from public.team_boilers('aaaaaaaa-0000-4000-a000-0000000000f1');
  if seen is distinct from array['aaaaaaaa-0000-4000-a000-00000000000c', 'aaaaaaaa-0000-4000-a000-00000000000e']::uuid[] then
    raise exception 'FAIL: member C should see C and E, saw %', seen;
  end if;
  raise notice 'PASS: member C';
end $$;

-- ---------------------------------------------------------------------------
-- As L (lead): sees self, 'everyone' and 'lead' members, never hidden B.
-- Still cannot read anyone's snapshot directly (preview goes through the admin client).
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-a000-00000000000a","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  seen uuid[];
  n int;
begin
  select array_agg(user_id order by user_id) into seen
  from public.team_boilers('aaaaaaaa-0000-4000-a000-0000000000f1');
  if seen is distinct from array[
    'aaaaaaaa-0000-4000-a000-00000000000a',
    'aaaaaaaa-0000-4000-a000-00000000000c',
    'aaaaaaaa-0000-4000-a000-00000000000e'
  ]::uuid[] then
    raise exception 'FAIL: lead L should see L, C and E, saw %', seen;
  end if;
  if public.team_hidden_count('aaaaaaaa-0000-4000-a000-0000000000f1') <> 0 then
    raise exception 'FAIL: lead L must not receive a count of one';
  end if;
  select count(*) into n from public.pressure_snapshots where user_id <> 'aaaaaaaa-0000-4000-a000-00000000000a';
  if n <> 0 then raise exception 'FAIL: lead L read % other snapshots directly', n; end if;
  raise notice 'PASS: lead L';
end $$;

-- ---------------------------------------------------------------------------
-- As X (outsider): sees nothing on the team.
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-a000-00000000000d","role":"authenticated"}', true);
set local role authenticated;

do $$
declare n int;
begin
  select count(*) into n from public.team_boilers('aaaaaaaa-0000-4000-a000-0000000000f1');
  if n <> 0 then raise exception 'FAIL: outsider X saw % boilers', n; end if;
  if public.team_hidden_count('aaaaaaaa-0000-4000-a000-0000000000f1') <> 0 then
    raise exception 'FAIL: outsider X got a hidden count';
  end if;
  select count(*) into n from public.teams where id = 'aaaaaaaa-0000-4000-a000-0000000000f1';
  if n <> 0 then raise exception 'FAIL: outsider X read the team row'; end if;
  raise notice 'PASS: outsider X';
end $$;

-- ---------------------------------------------------------------------------
-- Toggle: B switches hidden -> lead -> everyone, and visibility follows.
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-a000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
update public.memberships set visibility = 'lead'
where team_id = 'aaaaaaaa-0000-4000-a000-0000000000f1' and user_id = 'aaaaaaaa-0000-4000-a000-00000000000b';

reset role;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-a000-00000000000e","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if exists (select 1 from public.team_boilers('aaaaaaaa-0000-4000-a000-0000000000f1')
             where user_id = 'aaaaaaaa-0000-4000-a000-00000000000b') then
    raise exception 'FAIL: non-lead E saw B after B chose lead-only';
  end if;
end $$;

reset role;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-a000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if not exists (select 1 from public.team_boilers('aaaaaaaa-0000-4000-a000-0000000000f1')
                 where user_id = 'aaaaaaaa-0000-4000-a000-00000000000b') then
    raise exception 'FAIL: lead L could not see B after B chose lead-only';
  end if;
end $$;

reset role;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-a000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
update public.memberships set visibility = 'everyone'
where team_id = 'aaaaaaaa-0000-4000-a000-0000000000f1' and user_id = 'aaaaaaaa-0000-4000-a000-00000000000b';

reset role;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-a000-00000000000e","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if not exists (select 1 from public.team_boilers('aaaaaaaa-0000-4000-a000-0000000000f1')
                 where user_id = 'aaaaaaaa-0000-4000-a000-00000000000b') then
    raise exception 'FAIL: member E could not see B after B chose everyone';
  end if;
  raise notice 'PASS: visibility toggle';
end $$;

reset role;
select 'ALL TEAM VISIBILITY TESTS PASSED' as result;

rollback;
