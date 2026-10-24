import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "./route";

const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), syncSelf: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/app/api/me/_lib/http", async (original) => ({
  ...(await original<typeof import("@/app/api/me/_lib/http")>()),
  requireUser: mocks.requireUser,
  syncSelf: mocks.syncSelf,
}));
const NOW = new Date("2026-10-24T12:00:00Z");
const USER = { id: "00000000-0000-4000-8000-000000000001" };
const SRC = "11111111-1111-4111-8111-111111111111";
const KEY = "a".repeat(64);
const ref = { sourceId: SRC, itemKey: KEY };
const request = (body: unknown) => new Request("http://localhost/api/sources/items", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
function database(owned = true) {
  const upsert = vi.fn(async () => ({ error: null }));
  return { upsert, client: { from: (table: string) => table === "sources"
    ? { select: () => ({ in: async () => ({ data: owned ? [{ id: SRC }] : [], error: null }) }) }
    : { upsert } } };
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  mocks.syncSelf.mockResolvedValue({ tasks: [{ id: `${SRC}:${KEY}`, dueAt: "2026-10-20T12:00:00Z", doneAt: null }] });
});
afterEach(() => { vi.useRealTimers(); vi.resetAllMocks(); });

describe("reviewing cleared source assignments", () => {
  it("requires sign-in before any source update", async () => {
    mocks.requireUser.mockResolvedValue(NextResponse.json({ error: "Not signed in" }, { status: 401 }));
    expect((await PATCH(request({ clear: true, items: [ref] }))).status).toBe(401);
    expect(mocks.syncSelf).not.toHaveBeenCalled();
  });
  it("checks source ownership before fetching work or writing marks", async () => {
    const db = database(false);
    mocks.requireUser.mockResolvedValue({ user: USER, supabase: db.client });
    expect((await PATCH(request({ clear: true, items: [ref] }))).status).toBe(404);
    expect(db.upsert).not.toHaveBeenCalled();
    expect(mocks.syncSelf).not.toHaveBeenCalled();
  });
  it.each([
    { dueAt: "2026-10-30T12:00:00Z", doneAt: null },
    { dueAt: "not-a-date", doneAt: null },
    { dueAt: null, doneAt: null },
    { dueAt: "2026-10-20T12:00:00Z", doneAt: NOW.toISOString() },
  ])("rejects a bulk clear of future, invalid, undated or already completed work: %j", async (task) => {
    const db = database();
    mocks.requireUser.mockResolvedValue({ user: USER, supabase: db.client });
    mocks.syncSelf.mockResolvedValue({ tasks: [{ id: `${SRC}:${KEY}`, ...task }] });
    expect((await PATCH(request({ clear: true, items: [ref] }))).status).toBe(400);
    expect(db.upsert).not.toHaveBeenCalled();
  });
  it("does not clear a task missing from the current feed", async () => {
    const db = database();
    mocks.requireUser.mockResolvedValue({ user: USER, supabase: db.client });
    mocks.syncSelf.mockResolvedValue({ tasks: [] });
    expect((await PATCH(request({ clear: true, items: [ref] }))).status).toBe(400);
    expect(db.upsert).not.toHaveBeenCalled();
  });
  it("marks reviewed overdue work at the actual time, then returns the refreshed score", async () => {
    const db = database();
    mocks.requireUser.mockResolvedValue({ user: USER, supabase: db.client });
    expect((await PATCH(request({ clear: true, items: [ref] }))).status).toBe(200);
    expect(db.upsert).toHaveBeenCalledWith([{ user_id: USER.id, source_id: SRC, item_key: KEY, done_at: NOW.toISOString(), updated_at: NOW.toISOString() }], expect.anything());
    expect(mocks.syncSelf).toHaveBeenCalledTimes(2);
  });
  it("restores a cleared assignment without changing its size override", async () => {
    const db = database();
    mocks.requireUser.mockResolvedValue({ user: USER, supabase: db.client });
    expect((await PATCH(request({ ...ref, done: false }))).status).toBe(200);
    expect(db.upsert).toHaveBeenCalledWith([{ user_id: USER.id, source_id: SRC, item_key: KEY, done_at: null, updated_at: NOW.toISOString() }], expect.anything());
  });
});
