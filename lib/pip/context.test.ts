import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ sources: vi.fn(), admin: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/sources/load", () => ({ loadSources: mocks.sources }));
vi.mock("./schedule-context", () => ({ scheduleContext: vi.fn(async () => ({ state: "disconnected", windows: [], busy: [] })) }));
import { assignmentContext } from "./context";
import type { SupabaseClient } from "@supabase/supabase-js";
afterEach(() => vi.resetAllMocks());
function database(tasks: unknown[], ownedSources: unknown[] = []) {
  const filters: unknown[][] = [];
  const tasksResult = { data: tasks, count: tasks.length, error: null };
  const from = vi.fn((table: string) => ({ select: () => ({
    eq: (...args: unknown[]) => {
      filters.push([table, ...args]);
      return table === "sources" ? Promise.resolve({ data: ownedSources, error: null }) : {
        is: (...where: unknown[]) => { filters.push(where); return { order: () => ({ limit: () => ({ returns: async () => tasksResult }) }) }; },
      };
    },
  }) }));
  return { client: { from } as unknown as SupabaseClient, filters };
}
describe("server-owned assignment context", () => {
  it("scopes database reads, excludes completed imported work and events, and strips URLs and source secrets", async () => {
    const db = database([{ title: "Manual draft", due_at: null, size: "M", source: "manual" }], [{ id: "owned-feed" }]);
    mocks.admin.mockReturnValue("server-admin");
    mocks.sources.mockResolvedValue({ sources: [{ status: "ok" }], items: [
      { kind: "task", title: "Lab report", due: "2026-10-25T16:00:00Z", size: "L", source: "ics", courseName: "Chemistry", url: "https://private.example/secret-token" },
      { kind: "task", title: "Completed", doneAt: "2026-10-24T12:00:00Z" },
      { kind: "task", title: "Completed remotely", completedInSource: true },
      { kind: "event", title: "Private meeting" },
    ] });
    const context = await assignmentContext(db.client, "verified-user", "UTC");
    expect(db.filters).toContainEqual(["tasks", "owner_id", "verified-user"]);
    expect(db.filters).toContainEqual(["sources", "user_id", "verified-user"]);
    expect(db.filters).toContainEqual(["done_at", null]);
    expect(mocks.sources).toHaveBeenCalledWith("server-admin", "verified-user", expect.any(Date), "UTC");
    expect(context.assignments.map((a) => a.title)).toEqual(["Lab report", "Manual draft"]);
    expect(context.assignments[0].course).toBe("Chemistry");
    expect(JSON.stringify(context)).not.toMatch(/secret-token|Private meeting|Completed/);
  });
  it("marks partial context, limits prompt size, and avoids admin access when there are no connected feeds", async () => {
    const db = database(Array.from({ length: 150 }, (_, i) => ({ title: `Task ${i}`, due_at: null, size: "S", source: "team" })));
    const context = await assignmentContext(db.client, "verified-user", "UTC");
    expect(context).toMatchObject({ totalOpen: 150, truncated: true, unavailableSources: 0 });
    expect(context.assignments).toHaveLength(100);
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("does not silently report a complete list when source loading fails", async () => {
    const db = database([], [{ id: "feed" }]);
    mocks.sources.mockResolvedValue({ items: [], sources: [] });
    await expect(assignmentContext(db.client, "verified-user", "UTC")).rejects.toThrow("Sources unavailable");
  });
  it.each([
    ["2026-10-25T21:00:00Z", "5:00:00 PM EDT"],
    ["2026-11-02T21:00:00Z", "4:00:00 PM EST"],
  ])("formats the real deadline in New York using the date's daylight-saving offset: %s", async (due_at, expected) => {
    const db = database([{ title: "Sync test", due_at, size: "M", source: "manual" }]);
    const context = await assignmentContext(db.client, "verified-user", "America/New_York", new Date("2026-10-24T22:00:00Z"));
    expect(context.assignments[0].dueLocal).toContain(expected);
    expect(context.assignments[0].dueAt).toBe(due_at);
    expect(context.asOfLocal).toContain("6:00:00 PM EDT");
  });
});
