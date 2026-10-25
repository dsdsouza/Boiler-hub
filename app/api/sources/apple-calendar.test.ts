import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decrypt } from "@/lib/crypto";
import { computePressure } from "@/lib/pressure/compute";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), syncSelf: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("node:dns/promises", () => ({ lookup: async () => [{ address: "93.184.216.34", family: 4 }] }));
vi.mock("@/app/api/me/_lib/http", async (original) => ({
  ...(await original<typeof import("@/app/api/me/_lib/http")>()),
  requireUser: mocks.requireUser,
  syncSelf: mocks.syncSelf,
}));

const FEED = readFileSync(join(__dirname, "../../../lib/sources/__fixtures__/icloud.ics"), "utf8");
const NOW = new Date("2026-10-26T12:00:00Z");
const USER = { id: "00000000-0000-4000-8000-000000000001" };
const LINK = "webcal://p123-caldav.icloud.com/published/2/example-calendar-token";

function request(body: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/sources", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind: "ics", url: LINK, coursework: false, ...body }),
  });
}

function database() {
  let inserted: Record<string, unknown> | null = null;
  const insert = vi.fn((row: Record<string, unknown>) => {
    inserted = row;
    return { select: () => ({ single: async () => ({ data: {
      ...row, last_synced_at: null, status: "ok", error: null, created_at: NOW.toISOString(),
    }, error: null }) }) };
  });
  const from = vi.fn(() => ({ select: () => ({ eq: async () => ({ count: 0, error: null }) }), insert }));
  return { client: { from }, insert, inserted: () => inserted };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.stubEnv("TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 1).toString("base64"));
  vi.stubGlobal("fetch", vi.fn(async () => new Response(FEED, { headers: { "content-type": "text/calendar" } })));
  mocks.syncSelf.mockResolvedValue({
    result: computePressure([], NOW), tasks: [], events: [], sources: [], calendar: "ok",
    status: { status: "open", note: null }, computedAt: NOW.toISOString(),
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetAllMocks();
  vi.restoreAllMocks();
});

describe("connecting an Apple Calendar through POST /api/sources", () => {
  it.each([undefined, "Work iCloud"])("normalizes and encrypts the link, retaining only owner-scoped source metadata (label=%s)", async (label) => {
    const db = database();
    mocks.requireUser.mockResolvedValue({ user: USER, supabase: db.client });
    const response = await POST(request(label ? { label } : {}));
    const json = await response.json();
    expect(response.status).toBe(201);
    expect(json).toMatchObject({ source: { label: label ?? "Apple Calendar", kind: "ics", coursework: false }, tasks: 1, events: 7 });
    expect(db.inserted()).toMatchObject({ user_id: USER.id, label: label ?? "Apple Calendar", kind: "ics", coursework: false });
    expect(Object.keys(db.inserted()!).sort()).toEqual(["coursework", "id", "kind", "label", "secret_encrypted", "user_id"]);
    expect(decrypt(db.inserted()!.secret_encrypted as string)).toBe(LINK.replace("webcal:", "https:"));
    expect(JSON.stringify(json)).not.toContain("example-calendar-token");
    expect(JSON.stringify(json)).not.toContain("secret_encrypted");
    expect(mocks.syncSelf).toHaveBeenCalledWith(USER, { freshSources: true });
  });

  it("requires sign-in before fetching a link or saving a source", async () => {
    mocks.requireUser.mockResolvedValue(NextResponse.json({ error: "Not signed in" }, { status: 401 }));
    expect((await POST(request())).status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.syncSelf).not.toHaveBeenCalled();
  });

  it("does not save a revoked link and returns a recoverable error without the secret", async () => {
    const db = database();
    mocks.requireUser.mockResolvedValue({ user: USER, supabase: db.client });
    vi.mocked(fetch).mockResolvedValue(new Response("", { status: 403 }));
    const response = await POST(request());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "The feed returned 403. The link may have expired: copy a fresh one" });
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("confirms a saved connection when only the following boiler refresh fails", async () => {
    const db = database();
    mocks.requireUser.mockResolvedValue({ user: USER, supabase: db.client });
    mocks.syncSelf.mockRejectedValue(new Error("test sync failure"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await POST(request());
    const json = await response.json();
    expect(response.status).toBe(201);
    expect(db.insert).toHaveBeenCalledOnce();
    expect(json).toMatchObject({ source: { label: "Apple Calendar" }, boiler: null, warning: expect.stringContaining("Saved") });
  });
});
