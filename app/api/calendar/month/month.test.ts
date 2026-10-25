import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), admin: vi.fn(), load: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/app/api/me/_lib/http", () => ({ requireUser: mocks.auth }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/sources/load", () => ({ loadSources: mocks.load }));
import { GET } from "./route";

const task = { id: "own", title: "Own deadline", due_at: "2026-12-01T04:30:00Z", source: "manual", course: null };
function database(tasks = [task], sources: { id: string }[] = []) {
  const operations: unknown[][] = [];
  const from = vi.fn((table: string) => {
    const q = Object.fromEntries(["select", "eq", "is", "gte", "lt", "order", "limit"].map((name) => [name, (...args: unknown[]) => { operations.push([table, name, ...args]); return q; }])) as Record<string, unknown>;
    q.then = (yes: (value: unknown) => unknown) => Promise.resolve({ data: table === "tasks" ? tasks : sources, count: tasks.length, error: null }).then(yes);
    return q;
  });
  mocks.auth.mockResolvedValue({ user: { id: "signed-in-owner" }, supabase: { from } });
  return { operations, from };
}
const request = (query = "month=2026-11&timeZone=America%2FNew_York&userId=someone-else") => new Request(`https://boilerplate.example/api/calendar/month?${query}`);
beforeEach(() => { vi.resetAllMocks(); mocks.admin.mockReturnValue({ admin: true }); mocks.load.mockResolvedValue({ sources: [], items: [] }); });

describe("owner month calendar", () => {
  it("requires authentication before reading tasks or source secrets", async () => {
    mocks.auth.mockResolvedValue(NextResponse.json({ error: "Not signed in" }, { status: 401 }));
    expect((await GET(request())).status).toBe(401);
    expect(mocks.admin).not.toHaveBeenCalled();
    expect(mocks.load).not.toHaveBeenCalled();
  });
  it("selects only the verified owner's open deadlines with DST-correct month bounds", async () => {
    const db = database();
    const response = await GET(request());
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect((await response.json()).deadlines).toEqual([{ id: "own", title: "Own deadline", dueAt: task.due_at, source: "manual" }]);
    expect(db.operations).toContainEqual(["tasks", "eq", "owner_id", "signed-in-owner"]);
    expect(db.operations).toContainEqual(["tasks", "is", "done_at", null]);
    expect(db.operations).toContainEqual(["tasks", "gte", "due_at", "2026-11-01T04:00:00.000Z"]);
    expect(db.operations).toContainEqual(["tasks", "lt", "due_at", "2026-12-01T05:00:00.000Z"]);
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it.each(["month=2026-13", "month=2026-2", "month=2026-11&timeZone=invalid-zone"])("rejects invalid windows (%s)", async (query) => {
    const db = database(); expect((await GET(request(query))).status).toBe(400); expect(db.from).not.toHaveBeenCalled();
  });
  it("loads source deadlines for the entire month and excludes completed entries and meetings", async () => {
    database([], [{ id: "source" }]);
    const imported = { id: "imported", title: "Imported", kind: "task", due: "2026-11-30T22:00:00Z", source: "ics", courseName: "Course" };
    mocks.load.mockResolvedValue({ sources: [{ status: "ok" }], items: [imported, { ...imported, id: "done", doneAt: "2026-10-24T12:00:00Z" }, { ...imported, id: "closed", completedInSource: true }, { ...imported, id: "meeting", kind: "event" }, { ...imported, id: "outside", due: "2026-12-01T05:00:00Z" }] });
    const data = await (await GET(request())).json();
    expect(data.deadlines).toEqual([{ id: "imported", title: "Imported", dueAt: imported.due, source: "ics", course: "Course" }]);
    expect(mocks.load).toHaveBeenCalledWith({ admin: true }, "signed-in-owner", expect.any(Date), "America/New_York", { dateWindow: { from: new Date("2026-10-30T04:00:00Z"), to: new Date("2026-12-03T05:00:00Z") } });
  });
  it("reports incomplete sources instead of claiming an empty month is complete", async () => {
    database([], [{ id: "source" }]);
    expect((await (await GET(request())).json()).unavailableSources).toBe(1);
  });
  it("does not expose internal failures", async () => {
    database([], [{ id: "source" }]); mocks.load.mockRejectedValue(new Error("secret credentials"));
    const response = await GET(request()); expect(response.status).toBe(503); expect(await response.text()).not.toContain("secret credentials");
  });
});
