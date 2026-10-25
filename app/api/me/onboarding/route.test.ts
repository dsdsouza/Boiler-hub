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
  sync: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("../_lib/http", async () => {
  const actual =
    await vi.importActual<typeof import("../_lib/http")>("../_lib/http");
  return {
    ...actual,
    requireUser: mocks.auth,
    syncSelf: mocks.sync,
    serverError: () =>
      NextResponse.json({ error: "Could not save" }, { status: 500 }),
  };
});
import { GET, PATCH } from "./route";
import { issueReview } from "./verification";
import type { BoilerResponse } from "@/lib/pressure/api-types";
const school = () => ({ sources: [{ id: "school", kind: "ics", label: "Brightspace", coursework: true, status: "ok", lastSyncedAt: "2026-10-24T10:00:00Z" }], tasks: [], events: [] }) as unknown as BoilerResponse;
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
  vi.stubEnv("TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
  vi.clearAllMocks();
  mocks.eq.mockResolvedValue({ error: null });
  mocks.task.mockResolvedValue({ error: null });
  mocks.profile.mockReturnValue({ eq: mocks.eq });
  mocks.from.mockImplementation((table) =>
    table === "profiles" ? { update: mocks.profile } : { upsert: mocks.task },
  );
  mocks.updateUser.mockResolvedValue({ error: null });
  mocks.sync.mockResolvedValue(school());
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
  it("autosaves unfinished and partial answers without changing the profile or creating a task", async () => {
    const draft = { ownerId: "owner-id", name: "A", role: "student", milestone: "Still typing", current: "name" };
    expect((await send(draft, { autosave: true, expectedUserId: "owner-id" })).status).toBe(200);
    expect(mocks.updateUser.mock.calls[0][0].data.onboarding).toMatchObject({ name: "A", milestone: "Still typing", ownerId: "owner-id", finished: false });
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.sync).not.toHaveBeenCalled();
  });
  it("rejects an autosave if the account changed after the draft was loaded", async () => {
    for (const expectedUserId of ["previous-account", undefined]) {
      expect((await send({ name: "Private answer" }, { autosave: true, expectedUserId })).status).toBe(409);
    }
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("does not allow a background save to finish onboarding or bypass setup checks", async () => {
    const draft = parseDraft({ name: "Alex", role: "professional", goal: "balance", starting: "fresh", finished: true });
    draft.completed = stepsFor(draft);
    expect((await send(draft, { autosave: true, expectedUserId: "owner-id" })).status).toBe(400);
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
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
    const extra = { deadlineAt: "2026-11-03T04:59:00Z", extensionVersion: "0.3.2", deadlinesReviewed: true, reviewReceipt: issueReview("owner-id", school()) };
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
    expect((await send(d, { extensionVersion: "0.3.2" })).status).toBe(500);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
  it("requires a current Pip reply and a valid reviewed import before finishing student setup", async () => {
    const draft = parseDraft({ role: "student", name: "Alex", goal: "balance", starting: "fresh", finished: true });
    draft.completed = stepsFor(draft);
    expect((await send(draft)).status).toBe(400);
    expect((await send(draft, { extensionVersion: "0.3.0" })).status).toBe(400);
    expect((await send(draft, { extensionVersion: "0.3.2", deadlinesReviewed: true, reviewReceipt: "forged" })).status).toBe(400);
    expect(mocks.updateUser).not.toHaveBeenCalled();
    const extra = { extensionVersion: "0.3.2", deadlinesReviewed: true, reviewReceipt: issueReview("owner-id", school()) };
    expect((await send(draft, extra)).status).toBe(200);
    expect(mocks.updateUser.mock.calls[0][0].data.onboarding_setup.sourceIds).toEqual(["school"]);
  });
  it("keeps Finish later unfinished without requiring an extension or course import", async () => {
    const draft = parseDraft({ role: "student", name: "Alex", current: "extension", finished: false });
    expect((await send(draft)).status).toBe(200);
    expect(mocks.sync).not.toHaveBeenCalled();
    expect(mocks.updateUser.mock.calls[0][0].data.onboarding.finished).toBe(false);
  });
});
