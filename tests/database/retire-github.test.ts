import { afterAll, beforeAll, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import type { PGlite } from '@electric-sql/pglite';
import { createDatabase } from './database';
import { uuidFor } from '../../scripts/qa/accounts.mjs';

const migrationName = '20261025015300_retire_github_sources.sql';
const migration = readFile(new URL(`../../supabase/migrations/${migrationName}`, import.meta.url), 'utf8');
const owner = uuidFor('retired-source-owner'), taskOwner = uuidFor('retired-task-owner'), other = uuidFor('unaffected-owner');
const github = uuidFor('retired-connection'), feed = uuidFor('preserved-feed');
const key = 'a'.repeat(64);
let db: PGlite;

beforeAll(async () => {
  db = await createDatabase({ before: migrationName });
  for (const id of [owner, taskOwner, other]) {
    await db.query('insert into auth.users(id,email) values ($1,$2)', [id, `${id}@example.invalid`]);
    await db.query("insert into pressure_snapshots(user_id,score,raw,zone) values ($1,50,5,'working')", [id]);
  }
  await db.query(`insert into sources(id,user_id,kind,label,secret_encrypted) values
    ($1,$3,'github','Retired','fictional-token'), ($2,$3,'ics','Keep calendar','fictional-feed')`, [github, feed, owner]);
  await db.query(`insert into source_item_state(user_id,source_id,item_key,size_override) values
    ($1,$2,$4,'L'), ($1,$3,$4,'S')`, [owner, github, feed, key]);
  for (const source of ['manual', 'team', 'ics', 'github']) {
    await db.query('insert into tasks(owner_id,title,source) values ($1,$2,$3)', [source === 'github' ? taskOwner : owner, source, source]);
  }
  await db.query("insert into google_tokens(user_id,refresh_token) values ($1,'fictional-google-token')", [owner]);
  await db.exec(await migration);
}, 60000);
afterAll(async () => { await db?.close(); });

it('removes GitHub connections, cascaded overrides and legacy tasks for every affected owner', async () => {
  expect((await db.query("select id from sources where kind='github'")).rows).toEqual([]);
  expect((await db.query('select source_id from source_item_state where source_id=$1', [github])).rows).toEqual([]);
  expect((await db.query("select id from tasks where source='github'")).rows).toEqual([]);
  // The account with only a legacy task also loses its stale pressure reading.
  expect((await db.query('select user_id from pressure_snapshots order by user_id')).rows).toEqual([{ user_id: other }]);
});

it('preserves accounts, Google credentials, calendar feeds, feed overrides and all other tasks', async () => {
  expect((await db.query('select id from profiles')).rows).toHaveLength(3);
  expect((await db.query('select user_id from google_tokens')).rows).toEqual([{ user_id: owner }]);
  expect((await db.query('select id,kind,label from sources')).rows).toEqual([{ id: feed, kind: 'ics', label: 'Keep calendar' }]);
  expect((await db.query('select source_id,item_key,size_override from source_item_state')).rows).toEqual([{ source_id: feed, item_key: key, size_override: 'S' }]);
  expect((await db.query<{ source: string }>('select source from tasks order by source::text')).rows.map(r => r.source)).toEqual(['ics', 'manual', 'team']);
});

it('is safe to reapply without deleting a recomputed pressure reading', async () => {
  await db.query("insert into pressure_snapshots(user_id,score,raw,zone) values ($1,20,1,'cool')", [owner]);
  const before = (await db.query('select * from pressure_snapshots order by user_id')).rows;
  await db.exec(await migration);
  expect((await db.query('select * from pressure_snapshots order by user_id')).rows).toEqual(before);
});

for (const role of ['authenticated', 'service_role']) {
  it(`${role} cannot recreate a GitHub connection or task`, async () => {
    for (const sql of [
      `insert into sources(user_id,kind,label,secret_encrypted) values ('${owner}','github','Blocked','fictional')`,
      `insert into tasks(owner_id,title,source) values ('${owner}','Blocked','github')`,
      `update tasks set source='github' where owner_id='${owner}'`,
      ...(role === 'service_role' ? [`update sources set kind='github' where id='${feed}'`] : []),
    ]) {
      await db.exec('begin');
      try {
        await db.query("select set_config('request.jwt.claim.sub',$1,true)", [owner]);
        await db.exec(`set local role ${role}`);
        await expect(db.exec(sql)).rejects.toMatchObject({ code: '23514' });
      } finally { await db.exec('rollback'); }
    }
  });
}
