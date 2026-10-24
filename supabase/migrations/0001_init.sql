-- Boilerplate: initial schema
-- Paste into the Supabase SQL editor and run once.
--
-- Access model
--   * RLS is enabled on every table. Direct table access is owner-only.
--   * Teammates read each other's boilers ONLY through team_boilers() / team_hidden_count().
--   * Team creation and joining go through create_team() / join_team().
--   * google_tokens has no policies: only the service role (server) can touch it.
--   * Anything else cross-user (role changes, assignment fan-out, preview reads of
--     pressure_snapshots.raw) uses the server-side admin client AFTER the route has
--     verified the caller's membership/role.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.profile_status as enum ('open', 'heads_down', 'running_hot', 'away');
create type public.team_type      as enum ('class', 'work');
create type public.team_role      as enum ('lead', 'member');
create type public.visibility     as enum ('hidden', 'lead', 'everyone');
create type public.task_size      as enum ('S', 'M', 'L');
create type public.task_source    as enum ('manual', 'team', 'ics', 'github');
create type public.event_weight   as enum ('light', 'normal', 'heavy');
create type public.zone           as enum ('cool', 'working', 'hot', 'redline');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text,
  avatar_url  text,
  status      public.profile_status not null default 'open',
  status_note text check (char_length(status_note) <= 80),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 80),
  type        public.team_type not null,
  invite_code text not null unique check (invite_code ~ '^[A-Z0-9]{6}$'),
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.memberships (
  team_id    uuid not null references public.teams (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       public.team_role not null default 'member',
  visibility public.visibility not null default 'hidden',
  joined_at  timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index memberships_user_id_idx on public.memberships (user_id);

create table public.team_assignments (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 200),
  due_at     timestamptz not null,
  size       public.task_size not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index team_assignments_team_id_idx on public.team_assignments (team_id);

create table public.tasks (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles (id) on delete cascade,
  title         text not null check (char_length(title) between 1 and 200),
  due_at        timestamptz,
  size          public.task_size not null default 'M',
  done_at       timestamptz,
  source        public.task_source not null default 'manual',
  assignment_id uuid references public.team_assignments (id) on delete cascade,
  created_at    timestamptz not null default now()
);
create index tasks_owner_id_idx on public.tasks (owner_id);
create index tasks_assignment_id_idx on public.tasks (assignment_id);
-- One fanned-out task per member per assignment (makes fan-out idempotent).
create unique index tasks_assignment_owner_uidx on public.tasks (assignment_id, owner_id)
  where assignment_id is not null;

create table public.event_weights (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  series_key text not null,  -- SHA-256 of recurringEventId, or of the event id
  weight     public.event_weight not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, series_key)
);

create table public.pressure_snapshots (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  score       integer not null check (score between 0 and 100),
  raw         double precision not null,
  zone        public.zone not null,
  counts      jsonb not null default '{}'::jsonb,  -- lib/types.ts Counts
  forecast    jsonb not null default '[]'::jsonb,  -- lib/types.ts ForecastDay[]
  computed_at timestamptz not null default now()
);

create table public.google_tokens (
  user_id       uuid primary key references public.profiles (id) on delete cascade,
  refresh_token text,          -- AES-256-GCM encrypted (lib/crypto.ts)
  access_token  text,
  expires_at    timestamptz,
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- New user -> profile
-- ---------------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Membership helpers (SECURITY DEFINER so policies do not recurse into memberships RLS)
-- ---------------------------------------------------------------------------
create function public.is_team_member(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships
    where team_id = p_team_id and user_id = auth.uid()
  );
$$;

create function public.is_team_lead(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships
    where team_id = p_team_id and user_id = auth.uid() and role = 'lead'
  );
$$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.profiles           enable row level security;
alter table public.teams              enable row level security;
alter table public.memberships        enable row level security;
alter table public.team_assignments   enable row level security;
alter table public.tasks              enable row level security;
alter table public.event_weights      enable row level security;
alter table public.pressure_snapshots enable row level security;
alter table public.google_tokens      enable row level security;

-- profiles: owner reads and updates own row (created by trigger)
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- teams: members read their teams. Create via create_team(), join via join_team().
create policy teams_select_member on public.teams
  for select to authenticated using (public.is_team_member(id));

-- memberships: read own rows; update only the visibility column on own rows.
create policy memberships_select_own on public.memberships
  for select to authenticated using (user_id = auth.uid());
create policy memberships_update_own on public.memberships
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke insert, update, delete on public.memberships from anon, authenticated;
grant update (visibility) on public.memberships to authenticated;

-- team_assignments: members of the team can read. Writes via admin client after lead check.
create policy team_assignments_select_member on public.team_assignments
  for select to authenticated using (public.is_team_member(team_id));

-- tasks, event_weights, pressure_snapshots: owner-only
create policy tasks_owner_all on public.tasks
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy event_weights_owner_all on public.event_weights
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy pressure_snapshots_owner_all on public.pressure_snapshots
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- google_tokens: no policies, and no grants to client roles. Service role only.
revoke all on public.google_tokens from anon, authenticated;

-- ---------------------------------------------------------------------------
-- team_boilers(team_id): BoilerCard rows the caller may see in a team.
--   Visible = own row, OR visibility 'everyone', OR visibility 'lead' and caller is a lead.
--   Returns nothing if the caller is not a member.
--   score/zone/counts/updated_at are null for members who have never synced.
-- ---------------------------------------------------------------------------
create function public.team_boilers(team_id uuid)
returns table (
  user_id     uuid,
  name        text,
  avatar_url  text,
  score       integer,
  zone        public.zone,
  status      public.profile_status,
  status_note text,
  counts      jsonb,
  updated_at  timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select m.role
    from public.memberships m
    where m.team_id = team_boilers.team_id and m.user_id = auth.uid()
  )
  select
    m.user_id,
    p.name,
    p.avatar_url,
    s.score,
    s.zone,
    p.status,
    p.status_note,
    s.counts,
    s.computed_at
  from public.memberships m
  cross join me
  join public.profiles p on p.id = m.user_id
  left join public.pressure_snapshots s on s.user_id = m.user_id
  where m.team_id = team_boilers.team_id
    and (
      m.user_id = auth.uid()
      or m.visibility = 'everyone'
      or (m.visibility = 'lead' and me.role = 'lead')
    )
  order by s.score desc nulls last;
$$;

-- team_hidden_count(team_id): number of team members the caller cannot see. 0 if not a member.
create function public.team_hidden_count(team_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select m.role
    from public.memberships m
    where m.team_id = team_hidden_count.team_id and m.user_id = auth.uid()
  )
  select count(*)::integer
  from public.memberships m
  cross join me
  where m.team_id = team_hidden_count.team_id
    and m.user_id <> auth.uid()
    and not (
      m.visibility = 'everyone'
      or (m.visibility = 'lead' and me.role = 'lead')
    );
$$;

-- ---------------------------------------------------------------------------
-- create_team(name, type): creates the team and the caller's lead membership atomically.
-- ---------------------------------------------------------------------------
create function public.create_team(name text, type public.team_type)
returns public.teams
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  -- No 0/O/1/I to keep codes easy to read aloud
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  v_team public.teams;
  i int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    begin
      insert into public.teams (name, type, invite_code, created_by)
      values (trim(create_team.name), create_team.type, v_code, auth.uid())
      returning * into v_team;
      exit;
    exception when unique_violation then
      -- invite code collision: try another
    end;
  end loop;

  insert into public.memberships (team_id, user_id, role, visibility)
  values (v_team.id, auth.uid(), 'lead', 'hidden');

  return v_team;
end;
$$;

-- join_team(code): joins the caller as a hidden member. Idempotent. Returns the team id.
create function public.join_team(code text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select t.id into v_team_id
  from public.teams t
  where t.invite_code = upper(trim(join_team.code));

  if v_team_id is null then
    raise exception 'invalid invite code' using errcode = 'P0002';
  end if;

  insert into public.memberships (team_id, user_id, role, visibility)
  values (v_team_id, auth.uid(), 'member', 'hidden')
  on conflict (team_id, user_id) do nothing;

  return v_team_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges: signed-in users only
-- ---------------------------------------------------------------------------
revoke execute on function public.handle_new_user()                       from public, anon, authenticated;
revoke execute on function public.is_team_member(uuid)                    from public, anon;
revoke execute on function public.is_team_lead(uuid)                      from public, anon;
revoke execute on function public.team_boilers(uuid)                      from public, anon;
revoke execute on function public.team_hidden_count(uuid)                 from public, anon;
revoke execute on function public.create_team(text, public.team_type)     from public, anon;
revoke execute on function public.join_team(text)                         from public, anon;
grant  execute on function public.is_team_member(uuid)                    to authenticated;
grant  execute on function public.is_team_lead(uuid)                      to authenticated;
grant  execute on function public.team_boilers(uuid)                      to authenticated;
grant  execute on function public.team_hidden_count(uuid)                 to authenticated;
grant  execute on function public.create_team(text, public.team_type)     to authenticated;
grant  execute on function public.join_team(text)                         to authenticated;
