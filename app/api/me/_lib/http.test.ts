import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => ({ auth: { getUser: mocks.getUser } }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/google/sync", () => ({ syncUser: vi.fn() }));
import { requireUser, serverError } from "./http";

beforeEach(() => vi.clearAllMocks());

it("keeps authentication throttling distinct from a signed-out session", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: { status: 429, code: "over_request_rate_limit" } });
  const response = await requireUser();
  expect(response).toBeInstanceOf(Response);
  if (!(response instanceof Response)) throw new Error("Expected a throttled response");
  expect(response.status).toBe(429);
  expect(response.headers.get("retry-after")).toBe("60");
  expect(response.headers.get("cache-control")).toBe("no-store");
});

it("returns a redacted retry response for upstream throttling", async () => {
  for (const error of [{ status: 429, message: "private upstream details" }, { code: "over_request_rate_limit" }]) {
    const response = serverError("onboarding answers", error);
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: "Too many requests. Please wait a minute, then try again." });
  }
});

it("still rejects an unverified caller without returning a user client", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: { id: "unverified" } }, error: { status: 401 } });
  const response = await requireUser();
  expect(response).toBeInstanceOf(Response);
  if (!(response instanceof Response)) throw new Error("Expected an unauthorized response");
  expect(response.status).toBe(401);
});
