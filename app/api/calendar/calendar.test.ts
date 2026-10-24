import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decrypt, encrypt } from "@/lib/crypto";
import * as subscription from "./subscription/route";
import { GET as feed } from "./feed/[token]/route";

const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), createClient: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/app/api/me/_lib/http", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

const user = { id: "00000000-0000-4000-8000-000000000001" };
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
type Row = { user_id: string; token_hash: string; token_encrypted: string };
function database() {
  let row: Row | null = null;
  const filters: unknown[][] = [];
  const from = vi.fn(() => ({
    select: () => ({ eq: (...args: unknown[]) => { filters.push(args); return { maybeSingle: async () => ({ data: row, error: null }) }; } }),
    insert: async (value: Row) => { row = value; return { error: null }; },
    delete: () => ({ eq: async (...args: unknown[]) => { filters.push(args); row = null; return { error: null }; } }),
  }));
  return { client: { from }, row: () => row, filters };
}

beforeEach(() => { vi.stubEnv("TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 1).toString("base64")); });
afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });

describe("private calendar subscription lifecycle", () => {
  it("creates an encrypted owner-scoped link, reuses it, and revokes it", async () => {
    const db = database();
    mocks.requireUser.mockResolvedValue({ user, supabase: db.client });
    expect(await (await subscription.GET()).json()).toEqual({ feedPath: null });
    const created = await subscription.POST();
    const body = await created.json();
    const token = body.feedPath.split("/").at(-1).slice(0, -4);
    expect(created.status).toBe(201);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(created.headers.get("cache-control")).toContain("no-store");
    expect(db.row()).toMatchObject({ user_id: user.id, token_hash: hash(token) });
    expect(db.row()!.token_encrypted).not.toContain(token);
    expect(decrypt(db.row()!.token_encrypted)).toBe(token);
    expect(await (await subscription.POST()).json()).toEqual(body);
    expect(await (await subscription.GET()).json()).toEqual(body);
    expect(await (await subscription.DELETE()).json()).toEqual({ feedPath: null });
    expect(db.row()).toBeNull();
    expect(db.filters.every(([column, value]) => column === "user_id" && value === user.id)).toBe(true);
    expect((await (await subscription.POST()).json()).feedPath).not.toBe(body.feedPath);
  });

  it("requires authentication for all subscription management actions", async () => {
    mocks.requireUser.mockImplementation(async () => NextResponse.json({ error: "Not signed in" }, { status: 401 }));
    for (const handler of [subscription.GET, subscription.POST, subscription.DELETE]) expect((await handler()).status).toBe(401);
  });

  it("reuses the winning link when two requests try to enable a subscription together", async () => {
    const token = "c".repeat(64);
    const read = vi.fn()
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { token_hash: hash(token), token_encrypted: encrypt(token) }, error: null });
    const insert = vi.fn(async () => ({ error: { code: "23505" } }));
    mocks.requireUser.mockResolvedValue({ user, supabase: { from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: read }) }), insert,
    }) } });
    const response = await subscription.POST();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ feedPath: `/api/calendar/feed/${token}.ics` });
    expect(insert).toHaveBeenCalledOnce();
  });

  it("reports a missing setup without generating an unusable link", async () => {
    const client = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { code: "42P01" } }) }) }) }) };
    mocks.requireUser.mockResolvedValue({ user, supabase: client });
    const response = await subscription.POST();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: expect.stringContaining("unavailable") });
  });

  it("keeps environment failures readable without leaking setup details", async () => {
    mocks.requireUser.mockRejectedValue(new Error("Missing Supabase configuration"));
    for (const handler of [subscription.GET, subscription.POST, subscription.DELETE]) {
      const response = await handler();
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: expect.stringContaining("unavailable") });
    }
  });
});

describe("calendar client feed access", () => {
  const token = "b".repeat(64);
  const request = new Request(`https://boilerhub.work/api/calendar/feed/${token}.ics`);
  const context = (file = `${token}.ics`) => ({ params: Promise.resolve({ token: file }) });

  it("serves the narrowly authorized feed without a website session or admin client", async () => {
    const rpc = vi.fn(async () => ({ data: { tasks: [{ id: "task-1", title: "Draft due", dueAt: "2026-10-27T17:00:00Z" }] }, error: null }));
    mocks.createClient.mockResolvedValue({ rpc });
    const response = await feed(request, context());
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("calendar_subscription_tasks", { p_token_hash: hash(token) });
    expect(response.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.text()).toContain("SUMMARY:Draft due");
    expect(mocks.requireUser).not.toHaveBeenCalled();
  });

  it("rejects malformed or revoked links and never turns a source failure into an empty calendar", async () => {
    expect((await feed(request, context("invalid.ics"))).status).toBe(404);
    expect(mocks.createClient).not.toHaveBeenCalled();
    mocks.createClient.mockResolvedValue({ rpc: async () => ({ data: null, error: null }) });
    expect((await feed(request, context())).status).toBe(404);
    mocks.createClient.mockResolvedValue({ rpc: async () => ({ data: null, error: { message: "database offline" } }) });
    expect((await feed(request, context())).status).toBe(503);
  });
});
