import { afterEach, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { POST } from "./route";
import { POST as testConnection } from "./[id]/test/route";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), admin: vi.fn(), fetchNew: vi.fn(), testSource: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/app/api/me/_lib/http", async (original) => ({ ...(await original<typeof import("@/app/api/me/_lib/http")>()), requireUser: mocks.auth }));
vi.mock("@/lib/sources/load", async (original) => ({ ...(await original<typeof import("@/lib/sources/load")>()), fetchNewSource: mocks.fetchNew, testSource: mocks.testSource }));
afterEach(() => vi.resetAllMocks());

it("rejects new GitHub connections before fetching, encrypting or storing their token", async () => {
  const from = vi.fn();
  mocks.auth.mockResolvedValue({ user: { id: "owner" }, supabase: { from } });
  const response = await POST(new Request("https://boilerplate.example/api/sources", { method: "POST", body: JSON.stringify({ kind: "github", token: "fictional-removed-token" }) }));
  expect(response.status).toBe(400);
  expect(await response.text()).not.toContain("fictional-removed-token");
  expect(from).not.toHaveBeenCalled();
  expect(mocks.fetchNew).not.toHaveBeenCalled();
});

it("checks ownership and refuses to test a retired connection before privileged access", async () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const eq = vi.fn(() => ({ maybeSingle: async () => ({ data: { id, kind: "github" }, error: null }) }));
  mocks.auth.mockResolvedValue({ user: { id: "owner" }, supabase: { from: () => ({ select: () => ({ eq }) }) } });
  expect((await testConnection(new Request("https://boilerplate.example"), { params: Promise.resolve({ id }) })).status).toBe(410);
  expect(eq).toHaveBeenCalledWith("id", id);
  expect(mocks.admin).not.toHaveBeenCalled();
  expect(mocks.testSource).not.toHaveBeenCalled();
});

it("keeps retired connection checks behind authentication", async () => {
  mocks.auth.mockResolvedValue(NextResponse.json({ error: "Not signed in" }, { status: 401 }));
  expect((await testConnection(new Request("https://boilerplate.example"), { params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }) })).status).toBe(401);
  expect(mocks.admin).not.toHaveBeenCalled();
});
