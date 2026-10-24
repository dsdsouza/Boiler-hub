import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDatabase } from "./database";

let db: PGlite;
const a = "00000000-0000-4000-8000-000000000091";
const b = "00000000-0000-4000-8000-000000000092";
beforeAll(async () => {
  db = await createDatabase();
  await db.query("insert into auth.users(id,email) values ($1,'pip-a@example.test'),($2,'pip-b@example.test')", [a,b]);
}, 60000);
afterAll(async () => { await db?.close(); });
async function identity(id: string) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [id]);
  await db.exec("set local role authenticated");
}
const take = async () => (await db.query<{ quota: { allowed: boolean; remaining?: number; retryAfter?: number } }>("select public.pip_chat_take_quota() as quota")).rows[0].quota;
async function transaction(work: () => Promise<void>) {
  await db.exec("begin");
  try { await work(); } finally { await db.exec("rollback"); }
}
describe("Pip chat budgets in real PostgreSQL", () => {
  it("atomically admits five requests per minute and keeps accounts separate", () => transaction(async () => {
    await identity(a);
    const results = await Promise.all(Array.from({ length: 12 }, take));
    expect(results.filter((q) => q.allowed)).toHaveLength(5);
    expect(results.filter((q) => !q.allowed).every((q) => q.retryAfter! > 0 && q.retryAfter! <= 60)).toBe(true);
    await identity(b);
    expect(await take()).toEqual({ allowed: true, remaining: 49 });
  }));
  it("caps a day at fifty and resets on the next UTC date", () => transaction(async () => {
    for (let index = 0; index < 50; index++) {
      await db.exec("reset role");
      await db.query("update pip_private.chat_usage set minute_started=statement_timestamp()-interval '2 minutes' where user_id=$1", [a]);
      await identity(a);
      expect((await take()).allowed).toBe(true);
    }
    expect(await take()).toMatchObject({ allowed: false });
    await db.exec("reset role");
    await db.query("update pip_private.chat_usage set usage_day=current_date-1,minute_started=statement_timestamp()-interval '2 minutes' where user_id=$1", [a]);
    await identity(a);
    expect(await take()).toEqual({ allowed: true, remaining: 49 });
  }));
  it("does not grant callers table access or counter reset permissions", () => transaction(async () => {
    await identity(a);
    expect((await db.query<{ allowed: boolean }>("select has_table_privilege('authenticated','pip_private.chat_usage','SELECT,INSERT,UPDATE,DELETE') as allowed")).rows[0].allowed).toBe(false);
    expect((await db.query<{ allowed: boolean }>("select has_function_privilege('anon','public.pip_chat_take_quota()','EXECUTE') as allowed")).rows[0].allowed).toBe(false);
    await expect(db.exec("select * from pip_private.chat_usage")).rejects.toThrow(/permission denied/i);
  }));
  it("requires an authenticated identity even when a caller has the function grant", () => transaction(async () => {
    await identity("");
    await expect(take()).rejects.toThrow(/Authentication required/);
  }));
});
