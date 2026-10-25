import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { computePressure } from "@/lib/pressure/compute";
import { PRESSURE_MODEL_VERSION } from "@/lib/pressure/config";
import { toMyBoilerData } from "@/components/boiler/fromApi";
import type { GoogleEvent } from "./calendar";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/crypto", () => ({ decrypt: (s: string) => s.replace(/^enc:/, "") }));
vi.mock("./client", () => ({
  GoogleReconnectError: class extends Error {},
  getAccessToken: async () => "token",
}));
const calendar = vi.hoisted(() => ({ fail: null as Error | null, events: [] as GoogleEvent[] }));
vi.mock("./calendar", () => ({
  fetchPrimaryEvents: async () => {
    if (calendar.fail) throw calendar.fail;
    return { events: calendar.events, timeZone: "America/New_York" };
  },
}));

const FEED = readFileSync(join(__dirname, "..", "sources", "__fixtures__", "brightspace.ics"), "utf8");
vi.mock("@/lib/sources/fetch", async (orig) => ({
  ...(await orig<typeof import("@/lib/sources/fetch")>()),
  safeFetchText: async (url: string) => {
    if (url.includes("broken")) throw new (await import("@/lib/sources/types")).SourceError("The feed returned 500");
    return FEED;
  },
}));

const { syncUser } = await import("./sync");

const NOW = new Date("2026-10-26T12:00:00Z");
const USER = "00000000-0000-4000-8000-000000000001";
const GOOD = "11111111-1111-4111-8111-111111111111";
const BAD = "22222222-2222-4222-8222-222222222222";

type Op = { table: string; op: string; payload?: unknown; filters: [string, unknown][] };

/** Chainable stand-in for the admin client: every filter returns the query, awaiting it resolves the table's data. */
function fakeAdmin(tables: Record<string, unknown[]>) {
  const writes: Op[] = [];
  const from = (table: string) => {
    const op: Op = { table, op: "select", filters: [] };
    const result = () => {
      if (op.op !== "select") {
        writes.push(op);
        return { data: null, error: null };
      }
      const rows = (tables[table] ?? []).filter((r) =>
        op.filters.every(([k, v]) => (r as Record<string, unknown>)[k] === undefined || (r as Record<string, unknown>)[k] === v),
      );
      return { data: rows, error: null };
    };
    const q: Record<string, unknown> = {
      select: () => q,
      eq: (k: string, v: unknown) => (op.filters.push([k, v]), q),
      or: () => q,
      order: () => q,
      returns: () => q,
      maybeSingle: async () => ({ data: (result().data as unknown[] | null)?.[0] ?? null, error: null }),
      update: (payload: unknown) => ((op.op = "update"), (op.payload = payload), q),
      upsert: (payload: unknown) => ((op.op = "upsert"), (op.payload = payload), q),
      then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => Promise.resolve(result()).then(resolve, reject),
    };
    return q;
  };
  return { admin: { from } as unknown as SupabaseClient, writes };
}

const source = (id: string, url: string, extra: Record<string, unknown> = {}) => ({
  id,
  user_id: USER,
  kind: "ics",
  label: id === GOOD ? "Brightspace" : "Broken feed",
  coursework: true,
  secret_encrypted: `enc:${url}`,
  last_synced_at: "2026-10-25T12:00:00Z",
  status: "ok",
  error: null,
  created_at: "2026-10-20T00:00:00Z",
  ...extra,
});

describe("syncUser with sources", () => {
  it("replaces a recent snapshot from an older model and stamps the shared formula version", async () => {
    for (const counts of [{}, { pressureModel: PRESSURE_MODEL_VERSION }]) {
      const { admin, writes } = fakeAdmin({ pressure_snapshots: [{ computed_at: NOW.toISOString(), counts }] });
      await syncUser(admin, USER, NOW, { persist: "ifStale" });
      const saved = writes.find(w => w.table === "pressure_snapshots");
      if ("pressureModel" in counts) expect(saved).toBeUndefined();
      else expect(saved?.payload).toMatchObject({ counts: { pressureModel: PRESSURE_MODEL_VERSION } });
    }
  });
  it("preserves every event factor and the forecast zone through the owner response", async () => {
    calendar.events = [{ id: "meeting", summary: "Organized review", start: { dateTime: "2026-10-27T12:00:00Z" }, end: { dateTime: "2026-10-27T14:00:00Z" }, organizer: { self: true }, attendees: Array.from({ length: 5 }, () => ({ responseStatus: "accepted" as const })) }];
    try {
      const { admin } = fakeAdmin({ profiles: [{ status: "open", status_note: null }] });
      const res = await syncUser(admin, USER, NOW);
      const view = toMyBoilerData(res);
      expect(res.events[0]).toMatchObject({ attendees: 5, isOrganizer: true });
      expect(view.timeZone).toBe("America/New_York");
      expect(computePressure(view.items, NOW, { timeZone: view.timeZone })).toEqual(res.result);
    } finally { calendar.events = []; }
  });
  it("still computes when one source errors, marks it, and counts the healthy one", async () => {
    const { admin, writes } = fakeAdmin({
      tasks: [{ id: "t1", title: "Essay", due_at: "2026-10-28T17:00:00Z", size: "M", done_at: null, source: "manual", assignment_id: null }],
      profiles: [{ status: "open", status_note: null }],
      sources: [source(GOOD, "https://school.example.com/feed.ics"), source(BAD, "https://broken.example.com/feed.ics")],
    });

    const res = await syncUser(admin, USER, NOW, { freshSources: true });

    expect(res.sources).toEqual([
      expect.objectContaining({ id: GOOD, status: "ok", error: null, lastSyncedAt: NOW.toISOString() }),
      expect.objectContaining({ id: BAD, status: "error", error: "The feed returned 500", lastSyncedAt: "2026-10-25T12:00:00Z" }),
    ]);
    const statusWrites = writes.filter((w) => w.table === "sources" && w.op === "update");
    expect(statusWrites.map((w) => w.payload)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "ok", last_synced_at: NOW.toISOString() }),
        { status: "error", error: "The feed returned 500" },
      ]),
    );

    const lab = res.tasks.find((t) => t.title === "Lab Report 3");
    expect(lab).toMatchObject({ source: "ics", sourceId: GOOD, sourceLabel: "Brightspace", size: "M" });
    expect(res.tasks.some((t) => t.id === "t1")).toBe(true);
    expect(res.events.some((e) => e.title === "BIO 101 Lecture")).toBe(true);
    expect(res.result.contributions.some((c) => c.itemId === lab!.id)).toBe(true);
    expect(writes.some((w) => w.table === "pressure_snapshots" && w.op === "upsert")).toBe(true);
  });

  it("on a new feed's first sync, excludes history without marking schoolwork complete", async () => {
    const { admin, writes } = fakeAdmin({
      profiles: [{ status: "open", status_note: null }],
      sources: [source(GOOD, "https://school.example.com/feed.ics", { last_synced_at: null, created_at: NOW.toISOString() })],
    });

    const res = await syncUser(admin, USER, NOW, { freshSources: true });

    expect(writes.some((w) => w.table === "source_item_state")).toBe(false);
    expect(res.tasks.some((t) => t.title === "Problem Set 5")).toBe(false);
    expect(res.tasks.some((t) => t.title === "Reading Response 1")).toBe(false);
    expect(res.tasks.some((t) => t.title === "Lab Report 3")).toBe(true);
    expect(res.result.counts.overdue).toBe(0);
    expect(res.result.contributions.every((c) => c.points > 0)).toBe(true);
  });

  it("keeps genuinely missed work from an existing connection until the owner completes it", async () => {
    const { admin, writes } = fakeAdmin({
      profiles: [{ status: "open", status_note: null }],
      sources: [source(GOOD, "https://school.example.com/feed.ics", { created_at: "2026-09-01T12:00:00Z" })],
    });
    const res = await syncUser(admin, USER, NOW, { freshSources: true });
    expect(res.tasks.find((t) => t.title === "Problem Set 5")?.doneAt).toBeNull();
    expect(res.tasks.find((t) => t.title === "Reading Response 1")?.doneAt).toBeNull();
    expect(res.result.counts.overdue).toBe(2);
    expect(writes.some((w) => w.table === "source_item_state")).toBe(false);
  });

  it("a Google outage gives a tasks-only result, not an error, and saves no snapshot", async () => {
    calendar.fail = new Error("Google Calendar fetch failed (503)");
    try {
      const { admin, writes } = fakeAdmin({
        tasks: [{ id: "t1", title: "Essay", due_at: "2026-10-28T17:00:00Z", size: "M", done_at: null, source: "manual", assignment_id: null }],
        profiles: [{ status: "open", status_note: null }],
      });
      const res = await syncUser(admin, USER, NOW);
      expect(res.calendar).toBe("unavailable");
      expect(res.result.score).toBeGreaterThan(0);
      expect(writes.some((w) => w.table === "pressure_snapshots")).toBe(false);
    } finally {
      calendar.fail = null;
    }
  });

  it("labels tasks with a course: the feed's label, a manual task's own, a team task's team name", async () => {
    const { admin } = fakeAdmin({
      tasks: [
        { id: "t1", title: "Essay", due_at: "2026-10-28T17:00:00Z", size: "M", done_at: null, source: "manual", assignment_id: null, course: "ENG 210" },
        { id: "t2", title: "Retro notes", due_at: "2026-10-28T17:00:00Z", size: "S", done_at: null, source: "team", assignment_id: "a1", course: null, team_assignments: { team_id: "team1" } },
        { id: "t3", title: "Unlabelled", due_at: null, size: "S", done_at: null, source: "manual", assignment_id: null, course: null },
      ],
      memberships: [{ user_id: USER, team_id: "team1", teams: { name: "Product Squad" } }],
      profiles: [{ status: "open", status_note: null }],
      sources: [source(GOOD, "https://school.example.com/feed.ics")],
    });

    const res = await syncUser(admin, USER, NOW);
    const by = new Map(res.tasks.map((t) => [t.id, t]));
    expect(by.get("t1")?.course).toBe("ENG 210");
    expect(by.get("t2")?.course).toBe("Product Squad");
    expect(by.get("t3")).not.toHaveProperty("course");
    expect(res.tasks.find((t) => t.title === "Lab Report 3")?.course).toBe("Brightspace");
    expect(res.events.find((e) => e.title === "BIO 101 Lecture")?.course).toBe("Brightspace");
    expect(res.timeZone).toBe("America/New_York");
  });

  it("leaves a team task unlabelled once the user has left the team", async () => {
    const { admin } = fakeAdmin({
      tasks: [{ id: "t2", title: "Retro notes", due_at: null, size: "S", done_at: null, source: "team", assignment_id: "a1", course: null, team_assignments: { team_id: "team1" } }],
      profiles: [{ status: "open", status_note: null }],
    });
    const res = await syncUser(admin, USER, NOW);
    expect(res.tasks[0]).not.toHaveProperty("course");
  });

  it("returns the UTC forecast zone when the calendar could not be read", async () => {
    calendar.fail = new Error("Google Calendar fetch failed (503)");
    try {
      const { admin } = fakeAdmin({ profiles: [{ status: "open", status_note: null }] });
      expect((await syncUser(admin, USER, NOW)).timeZone).toBe("UTC");
    } finally {
      calendar.fail = null;
    }
  });

  it("works with no sources at all", async () => {
    const { admin } = fakeAdmin({ profiles: [{ status: "open", status_note: null }] });
    const res = await syncUser(admin, USER, NOW);
    expect(res.sources).toEqual([]);
    expect(res.result.score).toBe(0);
  });
});
