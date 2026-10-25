-- Apply in the Supabase SQL editor after deploying the GitHub integration removal.
-- Permanently remove every retired connection, including its encrypted token.
-- source_item_state rows cascade from sources; calendar feeds and accounts stay intact.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Prevent concurrent writes from recreating retired data during the cleanup.
lock table public.sources, public.tasks, public.pressure_snapshots in share row exclusive mode;

-- A saved reading may include GitHub pressure. Discard affected readings so the
-- owner's next sync computes them from supported sources instead of guessing a deduction.
with affected as (
  select user_id from public.sources where kind = 'github'
  union
  select owner_id from public.tasks where source = 'github'
)
delete from public.pressure_snapshots where user_id in (select user_id from affected);

delete from public.sources where kind = 'github';
delete from public.tasks where source = 'github';

-- Keep enum values for old clients' type compatibility, but reject all GitHub
-- inserts/updates at the database boundary, including service-role writes.
-- Re-running the migration is safe and preserves newly recomputed readings.
alter table public.sources drop constraint if exists sources_calendar_only;
alter table public.sources add constraint sources_calendar_only check (kind = 'ics');
alter table public.tasks drop constraint if exists tasks_supported_source;
alter table public.tasks add constraint tasks_supported_source check (source <> 'github');

commit;
