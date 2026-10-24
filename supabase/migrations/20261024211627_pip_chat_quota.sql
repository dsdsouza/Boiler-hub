-- Per-account chat budgets only. Never store prompts, replies, or assignment contents.
create schema if not exists pip_private;
revoke all on schema pip_private from public, anon, authenticated;
grant usage on schema pip_private to authenticated;

create table pip_private.chat_usage (
  user_id uuid primary key references auth.users(id) on delete cascade,
  usage_day date not null,
  requests integer not null check (requests between 1 and 50),
  minute_started timestamptz not null,
  minute_requests integer not null check (minute_requests between 1 and 5)
);
alter table pip_private.chat_usage enable row level security;
revoke all on pip_private.chat_usage from public, anon, authenticated;
create policy chat_usage_no_direct_access on pip_private.chat_usage
  as restrictive for all to authenticated using (false) with check (false);

-- A private, narrowly granted definer is needed so callers cannot reset their counters.
-- No caller-supplied identity, clock, limits, dynamic SQL, or content enters this function.
create function pip_private.take_chat_quota()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  moment timestamptz := statement_timestamp();
  today date := (moment at time zone 'UTC')::date;
  used pip_private.chat_usage%rowtype;
begin
  if actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  insert into pip_private.chat_usage as quota (user_id, usage_day, requests, minute_started, minute_requests)
  values (actor, today, 1, moment, 1)
  on conflict (user_id) do update set
    usage_day = today,
    requests = case when quota.usage_day <> today then 1 else quota.requests + 1 end,
    minute_started = case when quota.minute_started <= moment - interval '1 minute' then moment else quota.minute_started end,
    minute_requests = case when quota.minute_started <= moment - interval '1 minute' then 1 else quota.minute_requests + 1 end
  where (quota.usage_day <> today or quota.requests < 50)
    and (quota.minute_started <= moment - interval '1 minute' or quota.minute_requests < 5)
  returning * into used;
  if found then return jsonb_build_object('allowed', true, 'remaining', 50 - used.requests); end if;
  select * into used from pip_private.chat_usage where user_id = actor;
  return jsonb_build_object('allowed', false, 'retryAfter', greatest(1, ceil(extract(epoch from (
    case when used.usage_day = today and used.requests >= 50
      then ((today + 1)::timestamp at time zone 'UTC') - moment
      else used.minute_started + interval '1 minute' - moment end
  )))::integer));
end;
$$;
revoke all on function pip_private.take_chat_quota() from public, anon, authenticated;
grant execute on function pip_private.take_chat_quota() to authenticated;

-- Only the invoker wrapper is exposed by PostgREST; it carries the authenticated JWT.
create function public.pip_chat_take_quota()
returns jsonb language sql volatile security invoker set search_path = '' as $$
  select pip_private.take_chat_quota();
$$;
revoke all on function public.pip_chat_take_quota() from public, anon, authenticated;
grant execute on function public.pip_chat_take_quota() to authenticated;
