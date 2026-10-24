import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import type { PGlite } from '@electric-sql/pglite';
import { createDatabase } from './database';
import { accountBank, uuidFor } from '../../scripts/qa/accounts.mjs';

const bank = accountBank('database');
let db: PGlite;
const sqlFile = (path: string) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
const iso = new Date('2026-10-24T12:00:00Z');

beforeAll(async () => {
  db = await createDatabase();
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
          const hidden = await db.query<{ count: number }>('select team_hidden_count($1) as count', [team.id]);
          const hiddenOthers = bank.users.filter((u) => u.team === team.key && u.visibility === 'hidden' && u.id !== actor.id).length;
          expect(hidden.rows[0].count).toBe(actor.team === team.key && actor.role === 'lead' && hiddenOthers >= 2 ? hiddenOthers : 0);
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
  it('runs the calendar subscription ownership and revocation contract', async () => {
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
