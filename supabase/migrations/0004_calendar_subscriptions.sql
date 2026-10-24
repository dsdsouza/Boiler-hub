-- Run manually in the Supabase SQL editor after 0001–0003.
-- A subscription grants read-only access to the owner's dated manual tasks and team assignments.
-- No calendar event contents, external credentials, or third-party source items are copied here.
create table public.calendar_subscriptions (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  token_encrypted text not null,
  created_at timestamptz not null default now()
);

alter table public.calendar_subscriptions enable row level security;
create policy calendar_subscriptions_owner on public.calendar_subscriptions
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.calendar_subscriptions from public, anon, authenticated;
grant select, insert, delete on public.calendar_subscriptions to authenticated;

-- Calendar clients have no website session. A high-entropy bearer link identifies this one feed.
-- The anonymous RPC returns only open dated tasks for its owner, never token rows or source secrets.
-- Null means an unknown/revoked link; { tasks: [] } is a valid empty calendar.
create function public.calendar_subscription_tasks(p_token_hash text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.jsonb_build_object('tasks', coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', t.id, 'title', t.title, 'dueAt', t.due_at
    ) order by t.due_at, t.id)
    from public.tasks t
    where t.owner_id = subscription.user_id
      and t.source in ('manual', 'team')
      and t.done_at is null and t.due_at is not null
  ), '[]'::jsonb))
  from public.calendar_subscriptions subscription
  where subscription.token_hash = p_token_hash;
$$;

revoke execute on function public.calendar_subscription_tasks(text) from public;
grant execute on function public.calendar_subscription_tasks(text) to anon, authenticated;
