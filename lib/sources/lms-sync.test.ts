import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { syncUser } from "@/lib/google/sync";
import { toMyBoilerData } from "@/components/boiler/fromApi";
import { forgetSource } from "./load";

const live = vi.hoisted(() => ({ text: "", downloads: 0 }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/crypto", () => ({ decrypt: (value: string) => value.replace(/^enc:/, "") }));
vi.mock("@/lib/google/client", () => ({ GoogleReconnectError: class extends Error {}, getAccessToken: async () => "test" }));
vi.mock("@/lib/google/calendar", () => ({ fetchPrimaryEvents: async () => ({ events: [], timeZone: "America/New_York" }) }));
vi.mock("./fetch", () => ({ safeFetchText: async () => { live.downloads++; return live.text; } }));

const SOURCE = "77777777-7777-4777-8777-777777777777";
const USER = "88888888-8888-4888-8888-888888888888";
const NOW = new Date("2026-10-23T12:00:00Z");
const feed = (version: number) => readFileSync(join(__dirname, "__fixtures__/lms", `brightspace-v${version}.ics`), "utf8");

function database() {
  const tables: Record<string, Record<string, unknown>[]> = {
    sources: [{ id: SOURCE, user_id: USER, kind: "ics", label: "Brightspace", coursework: true, secret_encrypted: "enc:https://school.example/d2l/le/calendar/feed/user/feed.ics?token=private-test-feed", status: "ok", error: null, last_synced_at: "2026-10-22T12:00:00Z", created_at: "2026-10-22T12:00:00Z" }],
    profiles: [{ id: USER, status: "open", status_note: null }],
    source_item_state: [],
  };
  const writes: { table: string; payload: unknown; filters: [string, unknown][] }[] = [];
  const from = (table: string) => {
    const filters: [string, unknown][] = [];
    let payload: unknown;
    let writing = false;
    const resolve = () => {
      if (writing) { writes.push({ table, payload, filters }); return { data: null, error: null }; }
      const rows = (tables[table] ?? []).filter((r) => filters.every(([k, v]) => r[k] === v));
      return { data: rows, error: null };
    };
    const q = {
      select: () => q, eq: (key: string, value: unknown) => { filters.push([key, value]); return q; },
      or: () => q, order: () => q, returns: () => q,
      update: (value: unknown) => { writing = true; payload = value; return q; },
      upsert: (value: unknown) => { writing = true; payload = value; return q; },
      maybeSingle: async () => ({ ...resolve(), data: resolve().data?.[0] ?? null }),
      then: (yes: (value: unknown) => unknown) => Promise.resolve(resolve()).then(yes),
    };
    return q;
  };
  return { admin: { from } as unknown as SupabaseClient, tables, writes };
}

afterEach(() => { forgetSource(SOURCE); live.downloads = 0; });

describe("LMS feed → live sync → owner UI", () => {
  it("bypasses the source cache on Refresh, reconciles changes, and preserves owner overrides", async () => {
    const db = database();
    live.text = feed(1);
    const first = await syncUser(db.admin, USER, NOW, { freshSources: true });
    expect(first.tasks).toHaveLength(3);
    expect(first.events).toEqual([]);
    const original = first.tasks.find((t) => /Lab/.test(t.title))!;
    db.tables.source_item_state.push({ user_id: USER, source_id: SOURCE, item_key: original.itemKey, done_at: "2026-10-23T11:00:00Z", size_override: "L" });
    live.text = feed(2);
    const cached = await syncUser(db.admin, USER, NOW);
    expect(live.downloads).toBe(1);
    expect(cached.tasks.some((t) => t.title === original.title)).toBe(true);
    const refreshed = await syncUser(db.admin, USER, NOW, { freshSources: true });
    expect(live.downloads).toBe(2);
    expect(refreshed.tasks).toHaveLength(3);
    expect(refreshed.tasks.some((t) => /Quiz/.test(t.title))).toBe(false);
    const renamed = refreshed.tasks.find((t) => t.id === original.id)!;
    expect(renamed).toMatchObject({ title: "UPDATED Lab Report A", dueAt: "2026-10-29T17:00:00.000Z", doneAt: "2026-10-23T11:00:00Z", size: "L", courseName: "TEST D2L BIO 101" });
    const view = toMyBoilerData(refreshed);
    expect(view.taskMeta?.[renamed.id]).toMatchObject({ courseName: "TEST D2L BIO 101", url: expect.stringContaining("/d2l/le/content/981101/Home") });
    expect(JSON.stringify(refreshed)).not.toContain("private-test-feed");
    expect(JSON.stringify(db.writes)).not.toContain("Lab Report");
    expect(db.writes.filter((w) => w.table === "sources").every((w) => w.filters.some(([k, v]) => k === "user_id" && v === USER))).toBe(true);
  });
});
