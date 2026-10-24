-- Apply by hand in the Supabase SQL editor after 0004.
-- Enforce the same lead-only, minimum-two aggregate at the database boundary.
create or replace function public.team_hidden_count(team_id uuid)
returns integer
language sql stable security definer set search_path = ''
as $$
  select case when count(*) >= 2 then count(*)::integer else 0 end
  from public.memberships m
  where m.team_id = team_hidden_count.team_id
    and m.visibility = 'hidden'
    and m.user_id <> auth.uid()
    and exists (
      select 1 from public.memberships lead
      where lead.team_id = team_hidden_count.team_id
        and lead.user_id = auth.uid() and lead.role = 'lead'
    );
$$;
revoke all on function public.team_hidden_count(uuid) from public, anon;
grant execute on function public.team_hidden_count(uuid) to authenticated;
