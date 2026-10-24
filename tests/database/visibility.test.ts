import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { accountBank, uuidFor } from '../../scripts/qa/accounts.mjs';

const bank = accountBank('database');
let db: PGlite;
const sqlFile = (path: string) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
const iso = new Date('2026-10-24T12:00:00Z');

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key, instance_id uuid, aud text, role text,
      email text unique, raw_user_meta_data jsonb default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
    $$;
    grant usage on schema auth, public to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to authenticated, service_role;
    alter default privileges in schema public grant all on sequences to authenticated, service_role;
  `);
  for (const file of ['0001_init.sql', '0002_sources.sql', '0003_assignment_client_key.sql', '0004_calendar_subscriptions.sql', '0005_hidden_count_privacy.sql', '0006_atomic_assignments.sql', '0007_assignment_snapshot_comparison.sql']) {
    await db.exec(await sqlFile(`supabase/migrations/${file}`));
  }
  for (const user of bank.users) {
    await db.query('insert into auth.users (id,email,raw_user_meta_data) values ($1,$2,$3)',
      [user.id, user.email, JSON.stringify({ full_name: user.name })]);
    await db.query('update profiles set status=$2,status_note=$3 where id=$1', [user.id, user.status, user.note]);
    await db.query("insert into tasks(id,owner_id,title,size,source) values ($1,$2,$3,'M','manual')",
      [uuidFor(`task:${user.key}`), user.id, `Private task for ${user.key}`]);
    if (user.hasSnapshot) await db.query(`insert into pressure_snapshots(user_id,score,raw,zone,computed_at)
      values ($1,$2,$3,$4,$5)`, [user.id, user.score, user.raw, user.zone, new Date(+iso - user.ageHours * 3600000).toISOString()]);
    await db.query("insert into sources(id,user_id,kind,label,secret_encrypted) values ($1,$2,'ics','QA feed','fixture-secret-not-real')",
      [uuidFor(`source:${user.key}`), user.id]);
  }
  for (const team of bank.teams) {
    const lead = bank.users.find((u) => u.team === team.key && u.role === 'lead')!;
    await db.query('insert into teams(id,name,type,invite_code,created_by) values ($1,$2,$3,$4,$5)',
      [team.id, team.name, team.type, team.inviteCode, lead.id]);
    for (const user of bank.users.filter((u) => u.team === team.key)) {
      await db.query('insert into memberships(team_id,user_id,role,visibility) values ($1,$2,$3,$4)',
        [team.id, user.id, user.role, user.visibility]);
    }
  }
  await db.query("insert into teams(id,name,type,invite_code,created_by) values ($1,'QA single hidden','work','QASING',$2)",
    [uuidFor('single-hidden-team'), bank.users[0].id]);
  for (const [index, role, visibility] of [[0, 'lead', 'everyone'], [2, 'member', 'hidden']] as const) {
    await db.query('insert into memberships(team_id,user_id,role,visibility) values ($1,$2,$3,$4)',
      [uuidFor('single-hidden-team'), bank.users[index].id, role, visibility]);
  }
}, 60000);
afterAll(async () => { await db?.close(); });

async function asUser(id: string, fn: () => Promise<void>) {
  await db.exec('begin');
  try {
    await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: id, role: 'authenticated' })]);
    await db.exec('set local role authenticated');
    await fn();
  } finally { await db.exec('rollback'); }
}

describe('32 real SQL identities against the shipped RLS policies', () => {
  for (const actor of bank.users) {
    it(`${actor.key}: task/profile/snapshot ownership and team visibility`, async () => {
      await asUser(actor.id, async () => {
        const tasks = await db.query<{ owner_id: string }>('select owner_id from tasks');
        expect(tasks.rows.map((r) => r.owner_id)).toEqual([actor.id]);
        const profiles = await db.query<{ id: string }>('select id from profiles');
        expect(profiles.rows.map((r) => r.id)).toEqual([actor.id]);
        const snapshots = await db.query<{ user_id: string }>('select user_id from pressure_snapshots');
        expect(snapshots.rows.every((r) => r.user_id === actor.id)).toBe(true);
        const sources = await db.query<{ user_id: string }>('select user_id,label from sources');
        expect(sources.rows.map((r) => r.user_id)).toEqual([actor.id]);
        for (const team of bank.teams) {
          const result = await db.query<{ user_id: string }>('select user_id from team_boilers($1)', [team.id]);
          const expected = actor.team !== team.key ? [] : bank.users.filter((target) => target.team === team.key &&
            (target.id === actor.id || target.visibility === 'everyone' || (actor.role === 'lead' && target.visibility === 'lead'))).map((u) => u.id);
          expect(result.rows.map((r) => r.user_id).sort()).toEqual(expected.sort());
        }
        const other = bank.users.find((u) => u.id !== actor.id)!;
        const write = await db.query("update tasks set title='unauthorized' where owner_id=$1 returning id", [other.id]);
        expect(write.rows).toEqual([]);
        await expect(db.query('update tasks set owner_id=$1 where owner_id=$2', [other.id, actor.id])).rejects.toThrow(/row.level security/i);
      });
    });
  }
  it('runs the existing five-person SQL visibility contract with rollback', async () => {
    try { await db.exec(await sqlFile('supabase/tests/teams_visibility.sql')); }
    finally { await db.exec('rollback'); }
  });
  it('runs the calendar-subscription token isolation SQL contract', async () => {
    try { await db.exec(await sqlFile('supabase/tests/calendar_subscriptions.sql')); }
    finally { await db.exec('rollback'); }
  });
  it('does not expose encrypted source secrets to a signed-in owner', async () => {
    await asUser(bank.users[0].id, async () => {
      await expect(db.query('select secret_encrypted from sources')).rejects.toThrow(/permission denied/i);
    });
  });
  it('cannot self-promote by updating memberships directly', async () => {
    const member = bank.users.find((u) => u.team && u.role === 'member')!;
    await asUser(member.id, async () => {
      await expect(db.query("update memberships set role='lead' where user_id=$1", [member.id])).rejects.toThrow(/permission denied/i);
    });
  });
  it('cannot insert an override for somebody else’s source', async () => {
    const owner = bank.users[0];
    await asUser(owner.id, async () => {
      await expect(db.query("insert into source_item_state(user_id,source_id,item_key) values ($1,$2,$3)",
        [owner.id, uuidFor(`source:${bank.users[1].key}`), 'a'.repeat(64)])).rejects.toThrow(/row.level security/i);
    });
  });
  it('QA-003: direct hidden-count RPC should hide counts from non-leads', async () => {
    const member = bank.users.find((u) => u.team === 'class' && u.role === 'member')!;
    await asUser(member.id, async () => {
      const result = await db.query<{ count: number }>('select team_hidden_count($1) as count', [bank.teams[0].id]);
      expect(result.rows[0].count).toBe(0);
    });
  });
  it('QA-003: the RPC should suppress a single hidden member for a lead', async () => {
    await asUser(bank.users[0].id, async () => {
      const result = await db.query<{ count: number }>('select team_hidden_count($1) as count', [uuidFor('single-hidden-team')]);
      expect(result.rows[0].count).toBe(0);
    });
  });
  it('never grants a signed-in owner access to Google refresh tokens', async () => {
    await asUser(bank.users[0].id, async () => {
      await expect(db.query('select * from google_tokens')).rejects.toThrow(/permission denied/i);
    });
  });
  it('does not grant anonymous callers the team visibility RPC', async () => {
    await db.exec('begin; set local role anon');
    try {
      await expect(db.query('select * from team_boilers($1)', [bank.teams[0].id])).rejects.toThrow(/permission denied/i);
    } finally { await db.exec('rollback'); }
  });
});

// These exercise the actual PostgreSQL transaction, including a failure in its middle.
describe('QA-006 atomic assignment posts', () => {
  const team = bank.teams[0];
  const lead = bank.users.find((u) => u.team === team.key && u.role === 'lead')!;
  const input = { title: 'QA atomic post', size: 'M' as const, due: '2026-10-25T12:00:00Z' };
  async function changes() {
    const { computeTargets } = await import('../../app/api/teams/_lib/assignment');
    const rows = (await db.query<{ user_id: string; raw: number | null; score: number | null; zone: 'cool'; counts: object | null; computed_at: Date | null; revision: number | null }>(`
      select m.user_id, s.raw, s.score, s.zone, s.counts, s.computed_at, s.revision from memberships m
      left join pressure_snapshots s on s.user_id=m.user_id
      where m.team_id=$1 and m.role <> 'lead' order by m.user_id`, [team.id])).rows;
    return rows.map((row) => {
      const result = computeTargets([{ userId: row.user_id, name: '', visible: true, raw: row.raw, score: row.score,
        zone: row.zone, updatedAt: row.computed_at?.toISOString() ?? null }], input, iso)[0];
      return { user_id: row.user_id, before: row.raw === null ? null : { revision: row.revision, raw: row.raw, score: row.score, zone: row.zone, counts: row.counts, computed_at: row.computed_at?.toISOString() },
        after: { raw: result.rawAfter, score: result.after, zone: result.zoneAfter, counts: { meetings: 0, meetingHours: 0, tasksDue: 1, overdue: 0 } } };
    });
  }
  const post = (key: string, rows: unknown, actor = lead.id) => db.query<{ result: { assignmentId: string; duplicate: boolean } }>(
    'select post_team_assignment($1,$2,$3,$4,$5,$6,$7) as result', [team.id, actor, input.title, input.due, input.size, key, JSON.stringify(rows)]);
  it('rolls back every write on a mid-post failure, then retries exactly once', async () => {
    const rows = await changes();
    const key = uuidFor('atomic-retry');
    const before = (await db.query<{ user_id: string; forecast: unknown }>('select * from pressure_snapshots order by user_id')).rows;
    const failId = rows.filter((r) => r.before !== null).at(-1)!.user_id;
    await db.exec(`create function public.qa_fail_snapshot() returns trigger language plpgsql as $$ begin
      if new.user_id = '${failId}'::uuid then raise exception 'QA injected snapshot failure'; end if;
      return new; end $$;
      create trigger qa_fail before update on pressure_snapshots for each row execute function qa_fail_snapshot();`);
    try { await expect(post(key, rows)).rejects.toThrow(/QA injected snapshot failure/); }
    finally { await db.exec('drop trigger qa_fail on pressure_snapshots; drop function qa_fail_snapshot()'); }
    expect((await db.query<{ user_id: string; forecast: unknown }>('select * from pressure_snapshots order by user_id')).rows).toEqual(before);
    expect((await db.query('select id from team_assignments where client_key=$1', [key])).rows).toEqual([]);
    expect((await db.query("select id from tasks where source='team'")).rows).toEqual([]);
    const first = (await post(key, rows)).rows[0].result;
    expect(first.duplicate).toBe(false);
    const after = (await db.query<{ user_id: string; forecast: unknown }>('select * from pressure_snapshots order by user_id')).rows;
    const second = (await post(key, rows)).rows[0].result;
    expect(second).toEqual({ ...first, duplicate: true });
    expect((await db.query<{ user_id: string; forecast: unknown }>('select * from pressure_snapshots order by user_id')).rows).toEqual(after);
    const recipients = (await db.query<{ owner_id: string }>('select owner_id from tasks where assignment_id=$1', [first.assignmentId])).rows;
    expect(recipients).toHaveLength(rows.length);
    expect(new Set(recipients.map((r) => r.owner_id)).size).toBe(rows.length);
    for (const change of rows) {
      const saved = (await db.query<{ raw: number; computed_at: Date; forecast: unknown }>('select raw,computed_at,forecast from pressure_snapshots where user_id=$1', [change.user_id])).rows[0];
      if (!change.before) expect(saved).toBeUndefined();
      else {
        expect(saved.raw).toBe(change.after.raw);
        expect(saved.computed_at.toISOString()).toBe(change.before.computed_at);
        expect(saved.forecast).toEqual(before.find((r) => r.user_id === change.user_id)!.forecast);
      }
    }
  });
  it('rejects stale snapshots without saving an assignment or overwriting newer scores', async () => {
    const rows = await changes();
    const recipient = rows.find((r) => r.before !== null)!;
    await db.query('update pressure_snapshots set raw=raw+2 where user_id=$1', [recipient.user_id]);
    const before = (await db.query<{ user_id: string; forecast: unknown }>('select * from pressure_snapshots order by user_id')).rows;
    const key = uuidFor('atomic-stale');
    await expect(post(key, rows)).rejects.toMatchObject({ code: '40001' });
    expect((await db.query<{ user_id: string; forecast: unknown }>('select * from pressure_snapshots order by user_id')).rows).toEqual(before);
    expect((await db.query('select id from team_assignments where client_key=$1', [key])).rows).toEqual([]);
  });
  it('requires an actual team lead even from the trusted server', async () => {
    await expect(post(uuidFor('atomic-nonlead'), await changes(), bank.users.find((u) => u.role === 'member')!.id)).rejects.toMatchObject({ code: '42501' });
  });
  it('accepts decimal serialization rounding with an exact revision as the real service role', async () => {
    await db.exec('begin; set local role service_role');
    try {
      const rows = await changes();
      for (const row of rows) if (row.before) row.before.raw = Number(row.before.raw!.toPrecision(14));
      await expect(post(uuidFor('atomic-service-rounded'), rows)).resolves.toMatchObject({ rows: [{ result: { duplicate: false } }] });
    } finally { await db.exec('rollback'); }
  });
  it('never grants authenticated callers the trusted posting function', async () => {
    const rows = await changes();
    await asUser(lead.id, async () => {
      await expect(post(uuidFor('atomic-denied'), rows)).rejects.toThrow(/permission denied/i);
    });
  });
});
