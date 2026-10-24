-- Boilerplate: idempotent assignment posts.
-- Paste into the Supabase SQL editor and run once, after 0002_sources.sql.
--
-- The Engine Room generates one UUID per assignment draft and sends it as client_key.
-- Posting the same draft twice (double click, retry, second tab) hits this constraint, and
-- POST /api/teams/[id]/assignments returns the first assignment instead of creating another.
-- Existing rows keep client_key null; nulls never conflict, so they are unaffected.
-- team_assignments has no client write policies (writes go through the admin client after a
-- lead check), so no grants change.

alter table public.team_assignments
  add column client_key uuid;

alter table public.team_assignments
  add constraint team_assignments_team_client_key_key unique (team_id, client_key);
