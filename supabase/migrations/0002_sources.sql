-- Boilerplate: external task sources (ICS feeds, GitHub)
-- Paste into the Supabase SQL editor and run once, after 0001_init.sql.
--
-- Access model
--   * Both tables are owner-only under RLS.
--   * sources.secret_encrypted (ICS URL or GitHub token, AES-256-GCM via lib/crypto.ts) is NOT
--     selectable by client roles: column-level grants below leave it out. Only the service role
--     (server, after an ownership check) reads it.
--   * Item titles and due dates are never stored: they are fetched live on each sync.
--     source_item_state keeps only the user's overrides, keyed by sha256 of the external id.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.source_kind   as enum ('ics', 'github');
create type public.source_status as enum ('ok', 'error');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.sources (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  kind             public.source_kind not null,
  label            text not null check (char_length(label) between 1 and 60),
  secret_encrypted text not null,
  -- ICS only: treat all-day entries as deadlines (Brightspace, Canvas). Ignored for GitHub.
  coursework       boolean not null default false,
  last_synced_at   timestamptz,
  status           public.source_status not null default 'ok',
  error            text check (char_length(error) <= 300),
  created_at       timestamptz not null default now()
);
create index sources_user_id_idx on public.sources (user_id);

create table public.source_item_state (
  user_id       uuid not null references public.profiles (id) on delete cascade,
  source_id     uuid not null references public.sources (id) on delete cascade,
  item_key      text not null check (item_key ~ '^[0-9a-f]{64}$'),  -- sha256 hex of the external id
  done_at       timestamptz,
  size_override public.task_size,
  updated_at    timestamptz not null default now(),
  primary key (user_id, source_id, item_key)
);
create index source_item_state_source_id_idx on public.source_item_state (source_id);

-- ---------------------------------------------------------------------------
-- Row-level security: owner-only
-- ---------------------------------------------------------------------------
alter table public.sources           enable row level security;
alter table public.source_item_state enable row level security;

create policy sources_owner_all on public.sources
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- A state row must point at one of the caller's own sources.
create policy source_item_state_owner_all on public.source_item_state
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.sources s where s.id = source_id and s.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Column privileges: clients never read the secret
-- ---------------------------------------------------------------------------
revoke all on public.sources from anon, authenticated;
grant select (id, user_id, kind, label, coursework, last_synced_at, status, error, created_at)
  on public.sources to authenticated;
grant insert (user_id, kind, label, secret_encrypted, coursework)
  on public.sources to authenticated;
grant update (label, coursework) on public.sources to authenticated;
grant delete on public.sources to authenticated;

revoke all on public.source_item_state from anon;
