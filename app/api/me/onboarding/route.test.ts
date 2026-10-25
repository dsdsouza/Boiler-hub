import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { parseDraft, stepsFor } from "@/app/onboarding/model";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  updateUser: vi.fn(),
  from: vi.fn(),
  profile: vi.fn(),
  task: vi.fn(),
  eq: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("../_lib/http", async () => {
  const actual =
    await vi.importActual<typeof import("../_lib/http")>("../_lib/http");
  return {
    ...actual,
    requireUser: mocks.auth,
    serverError: () =>
      NextResponse.json({ error: "Could not save" }, { status: 500 }),
  };
});
import { GET, PATCH } from "./route";
const send = (draft: unknown, extra = {}) =>
  PATCH(
    new Request("https://boilerhub.work/api/me/onboarding", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ draft, ...extra }),
    }),
  );
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://qa-project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "qa-key");
  vi.clearAllMocks();
  mocks.eq.mockResolvedValue({ error: null });
  mocks.task.mockResolvedValue({ error: null });
  mocks.profile.mockReturnValue({ eq: mocks.eq });
  mocks.from.mockImplementation((table) =>
    table === "profiles" ? { update: mocks.profile } : { upsert: mocks.task },
  );
  mocks.updateUser.mockResolvedValue({ error: null });
  mocks.auth.mockResolvedValue({
    user: { id: "owner-id", user_metadata: { onboarding: { name: "Alex" } } },
    supabase: { from: mocks.from, auth: { updateUser: mocks.updateUser } },
  });
});
afterEach(() => vi.unstubAllEnvs());
describe("owner-scoped onboarding persistence", () => {
  it("returns signed out in a preview without auth configuration", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect((await GET()).status).toBe(401);
    expect((await send({})).status).toBe(401);
    expect(mocks.auth).not.toHaveBeenCalled();
  });
  it("rejects signed-out reads and writes", async () => {
    mocks.auth.mockResolvedValue(
      NextResponse.json({ error: "Not signed in" }, { status: 401 }),
    );
    expect((await GET()).status).toBe(401);
    expect((await send({})).status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
  it("loads only verified caller metadata, without caching it", async () => {
    const response = await GET();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      userId: "owner-id",
      draft: { name: "Alex" },
    });
  });
  it("binds a draft to the verified owner, ignoring caller-supplied identity", async () => {
    expect(
      (await send({ ownerId: "victim", name: "Alex", role: "student" })).status,
    ).toBe(200);
    expect(mocks.updateUser.mock.calls[0][0].data.onboarding.ownerId).toBe(
      "owner-id",
    );
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("does not mark incomplete questions as complete", async () => {
    expect((await send({ finished: true, completed: ["ready"] })).status).toBe(
      400,
    );
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
  it("saves the status and creates the first task once with an owner-scoped, repeatable id", async () => {
    const d = parseDraft({
      role: "student",
      name: "Alex",
      goal: "deadlines",
      starting: "fresh",
      status: "heads_down",
      note: "Lab week",
      milestone: "Lab report",
      deadline: "2026-11-02",
      finished: true,
    });
    d.completed = stepsFor(d);
    const extra = { deadlineAt: "2026-11-03T04:59:00Z" };
    expect((await send(d, extra)).status).toBe(200);
    expect((await send(d, extra)).status).toBe(200);
    expect(mocks.eq).toHaveBeenCalledWith("id", "owner-id");
    expect(mocks.profile).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Alex",
        status: "heads_down",
        status_note: "Lab week",
      }),
    );
    const [row, options] = mocks.task.mock.calls[0];
    expect(row).toMatchObject({
      owner_id: "owner-id",
      title: "Lab report",
      due_at: extra.deadlineAt,
    });
    expect(options).toEqual({ onConflict: "id", ignoreDuplicates: false });
    expect(mocks.task.mock.calls[1][0].id).toBe(row.id);
    expect(mocks.updateUser.mock.calls[0][0].data.onboarding.finished).toBe(
      true,
    );
  });
  it("keeps completion unsaved if the real profile could not be saved", async () => {
    const d = parseDraft({
      role: "professional",
      name: "Alex",
      goal: "balance",
      starting: "calendar",
      finished: true,
    });
    d.completed = stepsFor(d);
    mocks.eq.mockResolvedValue({ error: new Error("database unavailable") });
    expect((await send(d)).status).toBe(500);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
});
