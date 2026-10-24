import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PGlite } from '@electric-sql/pglite';
import { createAssignment, type TargetWithCounts } from '../../lib/data/teams';
import { computeTargets } from '../../app/api/teams/_lib/assignment';
import { createDatabase } from './database';
import { uuidFor } from '../../scripts/qa/accounts.mjs';

const lead = uuidFor('post-lead'), member = uuidFor('post-member');
const hidden = uuidFor('post-hidden'), never = uuidFor('post-never');
const team = uuidFor('post-team'), key = uuidFor('post-draft');
const now = new Date('2026-10-24T12:00:00Z');
const input = { title: 'QA recover interrupted assignment', size: 'M' as const, due: '2026-11-03T12:00:00Z' };
const targets: TargetWithCounts[] = [member, hidden, never].map((userId) => ({
  userId, name: 'Synthetic recipient', visible: userId !== hidden,
  raw: userId === never ? null : 8, score: userId === never ? null : 61,
  zone: userId === never ? null : 'working', updatedAt: userId === never ? null : now.toISOString(),
  snapshotRevision: userId === never ? undefined : 0,
  counts: userId === never ? null : { meetings: 1, meetingHours: 2, tasksDue: 3, overdue: 0 },
}));
let db: PGlite;
// Transport adapter only: the real helper's payload executes the shipped SQL
// function, constraints, triggers and permissions in actual PostgreSQL.
const admin = { async rpc(name: string, p: Record<string, unknown>) {
  expect(name).toBe('post_team_assignment');
  try {
    const result = await db.query<{ result: unknown }>(`select public.post_team_assignment(
      $1::uuid,$2::uuid,$3::text,$4::timestamptz,$5::public.task_size,$6::uuid,$7::jsonb) as result`,
      [p.p_team_id, p.p_created_by, p.p_title, p.p_due, p.p_size, p.p_client_key, JSON.stringify(p.p_changes)]);
    return { data: result.rows[0].result, error: null };
  } catch (error) { return { data: null, error }; }
}, from(table: string) {
  const sql = table === 'memberships' ? `select user_id,visibility from memberships where team_id='${team}' and role='member'`
    : table === 'profiles' ? 'select id,name from profiles' : 'select * from pressure_snapshots';
  const chain = { select: () => chain, eq: () => chain, in: () => chain,
    then: (resolve: (value: unknown) => unknown) => db.query(sql).then(({ rows }) => resolve({ data: JSON.parse(JSON.stringify(rows)), error: null })),
  };
  return chain;
} } as unknown as SupabaseClient;
const post = (draft = key, recipientTargets = targets, actor = lead) => createAssignment(
  admin, team, actor, input, recipientTargets, computeTargets(recipientTargets, input, now), now, draft,
);

beforeAll(async () => {
  db = await createDatabase();
  for (const id of [lead, member, hidden, never]) {
    await db.query('insert into auth.users(id,email) values ($1,$2)', [id, `${id}@example.invalid`]);
  }
  await db.query("insert into teams(id,name,type,invite_code,created_by) values ($1,'Assignment QA','work','QAPOST',$2)", [team, lead]);
  for (const id of [lead, member, hidden, never]) {
    await db.query('insert into memberships(team_id,user_id,role,visibility) values ($1,$2,$3,$4)',
      [team, id, id === lead ? 'lead' : 'member', id === hidden ? 'hidden' : 'everyone']);
  }
}, 60000);
beforeEach(async () => {
  await db.exec('delete from team_assignments; delete from pressure_snapshots;');
  for (const id of [member, hidden]) {
    await db.query(`insert into pressure_snapshots(user_id,raw,score,zone,counts,forecast,computed_at)
      values ($1,8,61,'working',$2,'[{"date":"2026-10-24","score":61,"zone":"working"}]',$3)`,
      [id, JSON.stringify(targets[0].counts), now.toISOString()]);
  }
});
afterAll(async () => { await db?.close(); });

it('QA-006: a failed snapshot write rolls back tasks and draft; retry commits once', async () => {
  await db.exec(`create function fail_qa_snapshot() returns trigger language plpgsql as $$
    begin raise exception 'Injected transient snapshot failure'; end $$;
    create trigger fail_qa_snapshot before update on pressure_snapshots for each row execute function fail_qa_snapshot();`);
  await expect(post()).rejects.toThrow('Injected transient snapshot failure');
  expect((await db.query('select id from team_assignments')).rows).toHaveLength(0);
  expect((await db.query('select id from tasks')).rows).toHaveLength(0);
  await db.exec('drop trigger fail_qa_snapshot on pressure_snapshots; drop function fail_qa_snapshot();');
  const result = await post();
  expect(result.duplicate).toBe(false);
  expect(await post()).toEqual({ ...result, duplicate: true });
  expect((await db.query('select id from team_assignments')).rows).toHaveLength(1);
  expect((await db.query<{ owner_id: string }>('select owner_id from tasks')).rows.map((r) => r.owner_id).sort()).toEqual([member, hidden, never].sort());
  const snapshots = await db.query<{ raw: number; counts: { tasksDue: number }; computed_at: Date; forecast: unknown[] }>('select * from pressure_snapshots');
  expect(snapshots.rows).toHaveLength(2); // Never-synced members receive a task, not a fabricated snapshot.
  for (const row of snapshots.rows) {
    expect(row.raw).toBe(computeTargets(targets, input, now)[0].rawAfter);
    expect(row.counts.tasksDue).toBe(4); // Ten-day tasks are in the current 14-day model.
    expect(new Date(row.computed_at).toISOString()).toBe(now.toISOString());
    expect(row.forecast).toHaveLength(1);
  }
});

it('reloads a competing snapshot before committing, without overwriting its load', async () => {
  await db.query('update pressure_snapshots set raw=9 where user_id=$1', [member]);
  await expect(post()).resolves.toMatchObject({ duplicate: false });
  const saved = await db.query<{ raw: number }>('select raw from pressure_snapshots where user_id=$1', [member]);
  expect(saved.rows[0].raw).toBe(computeTargets([{ ...targets[0], raw: 9 }], input, now)[0].rawAfter);
  expect((await db.query('select id from team_assignments')).rows).toHaveLength(1);
});

it('reloads changed recipients and still rejects a non-lead caller', async () => {
  await expect(post(key, targets.slice(0, 1))).resolves.toMatchObject({ duplicate: false });
  expect((await db.query('select id from tasks')).rows).toHaveLength(3);
  await expect(post(key, targets, member)).rejects.toThrow(/lead.*required/i);
  expect((await db.query('select id from team_assignments')).rows).toHaveLength(1);
});

it.each(['anon', 'authenticated'])('never lets %s supply snapshot updates through the RPC', async (role) => {
  await db.exec(`begin; set local role ${role}`);
  try { await expect(post()).rejects.toThrow(/permission denied/i); }
  finally { await db.exec('rollback'); }
});

it('allows the verified API service role to post without database-owner privileges', async () => {
  await db.exec('begin; set local role service_role');
  try { await expect(post()).resolves.toMatchObject({ duplicate: false }); }
  finally { await db.exec('rollback'); }
});
