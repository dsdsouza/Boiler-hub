import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { decrypt } from "@/lib/crypto";
import { verifyReview } from "@/app/api/me/onboarding/verification";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), syncSelf: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("node:dns/promises", () => ({ lookup: async () => [{ address: "93.184.216.34", family: 4 }] }));
vi.mock("@/app/api/me/_lib/http", async (original) => ({
  ...(await original<typeof import("@/app/api/me/_lib/http")>()), requireUser: mocks.requireUser, syncSelf: mocks.syncSelf,
}));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

it("imports a Brightspace schedule through the source endpoint without persisting class contents", async () => {
  const now = new Date("2026-10-26T12:00:00Z");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
  vi.stubEnv("TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 1).toString("base64"));
  const feed = readFileSync(join(__dirname, "../../../lib/sources/__fixtures__/brightspace.ics"), "utf8");
  vi.stubGlobal("fetch", vi.fn(async () => new Response(feed, { headers: { "content-type": "text/calendar" } })));
  const user = { id: "00000000-0000-4000-8000-000000000001" };
  const insert = vi.fn((row: Record<string, unknown>) => ({
    select: () => ({ single: async () => ({ data: { ...row, status: "ok", error: null, last_synced_at: now.toISOString() }, error: null }) }),
  }));
  mocks.requireUser.mockResolvedValue({ user, supabase: { from: () => ({ select: () => ({ eq: async () => ({ count: 0, error: null }) }), insert }) } });
  mocks.syncSelf.mockImplementation(async () => ({
    sources: [{ id: insert.mock.calls[0]![0].id, kind: "ics", label: "Brightspace", coursework: true, status: "ok", error: null, lastSyncedAt: now.toISOString() }],
    tasks: [], events: [],
  }));
  const link = "https://purdue.brightspace.com/d2l/le/calendar/feed/user/feed.ics?token=fictional-schedule-token";

  const response = await POST(new Request("http://localhost/api/sources", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind: "ics", url: link, label: "Brightspace", coursework: true }),
  }));
  const json = await response.json();
  expect(response.status).toBe(201);
  expect(json.source).toMatchObject({ kind: "ics", label: "Brightspace", coursework: true, status: "ok" });
  expect(json.events).toBe(7);
  expect(json.tasks).toBeGreaterThan(0);
  expect(verifyReview(json.reviewReceipt, user.id, json.boiler)).toBe(true);
  expect(verifyReview(json.reviewReceipt, "another-user", json.boiler)).toBe(false);
  const saved = insert.mock.calls[0]![0];
  expect(saved.user_id).toBe(user.id);
  expect(Object.keys(saved).sort()).toEqual(["coursework", "id", "kind", "label", "secret_encrypted", "user_id"]);
  expect(decrypt(saved.secret_encrypted as string)).toBe(link);
  expect(JSON.stringify(json)).not.toContain("fictional-schedule-token");
  expect(JSON.stringify(saved)).not.toContain("BIO 101 Lecture");
  expect(mocks.syncSelf).toHaveBeenCalledWith(user, { freshSources: true });
});
