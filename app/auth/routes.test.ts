import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ oauth: vi.fn(), exchange: vi.fn(), upsert: vi.fn(), admin: vi.fn(), encrypt: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { signInWithOAuth: mocks.oauth, exchangeCodeForSession: mocks.exchange } }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/crypto", () => ({ encrypt: mocks.encrypt }));
import { GET as start } from "./signin/route";
import { GET as callback } from "./callback/route";
const request = (path: string, cookie = "") => new NextRequest("http://localhost:3000" + path, { headers: { host: "localhost:3000", cookie } });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://qa-project.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "qa-key");
  mocks.oauth.mockResolvedValue({ data: { url: "https://qa-project.supabase.co/auth/v1/authorize?provider=google" }, error: null });
  mocks.exchange.mockResolvedValue({ data: { session: { user: { id: "verified-owner" }, provider_token: "synthetic-access", provider_refresh_token: "synthetic-refresh" } }, error: null });
  mocks.upsert.mockResolvedValue({ error: null }); mocks.admin.mockReturnValue({ from: () => ({ upsert: mocks.upsert }) }); mocks.encrypt.mockReturnValue("encrypted-refresh");
});
afterEach(() => vi.unstubAllEnvs());
describe("Google signup and its saved return path", () => {
  it("starts Google PKCE with the allowed callback and retains the onboarding destination", async () => {
    const response = await start(request("/auth/signin?next=%2Fonboarding"));
    expect(response.status).toBe(307); expect(response.headers.get("location")).toContain("/auth/v1/authorize");
    expect(mocks.oauth.mock.calls[0][0]).toMatchObject({ provider: "google", options: { redirectTo: "http://localhost:3000/auth/callback", queryParams: { access_type: "offline" } } });
    expect(response.cookies.get("bp_next")?.value).toBe("/onboarding");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  });
  it("returns a failed or unconfigured signup to its saved journey", async () => {
    mocks.oauth.mockResolvedValue({ data: { url: null }, error: new Error("synthetic") });
    expect((await start(request("/auth/signin?next=%2Fonboarding"))).headers.get("location")).toBe("http://localhost:3000/onboarding?error=signin");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", ""); mocks.oauth.mockClear();
    expect((await start(request("/auth/signin?next=%2Fonboarding"))).headers.get("location")).toContain("/onboarding?error=signin"); expect(mocks.oauth).not.toHaveBeenCalled();
  });
  it("rejects an external next destination", async () => {
    expect((await start(request("/auth/signin?next=%2F%5Cevil.example"))).cookies.get("bp_next")?.value).toBe("/onboarding");
  });
  it("exchanges the callback code and stores encrypted Google tokens only for its verified owner", async () => {
    const response = await callback(request("/auth/callback?code=synthetic-code", "bp_next=%2Fonboarding"));
    expect(mocks.exchange).toHaveBeenCalledWith("synthetic-code");
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "verified-owner", access_token: "synthetic-access", refresh_token: "encrypted-refresh" }), { onConflict: "user_id" });
    expect(mocks.encrypt).toHaveBeenCalledWith("synthetic-refresh"); expect(response.headers.get("location")).toBe("http://localhost:3000/onboarding");
    expect(response.cookies.get("bp_next")?.value).toBe("");
  });
  it("preserves an existing refresh token if Google does not reissue it", async () => {
    mocks.exchange.mockResolvedValue({ data: { session: { user: { id: "verified-owner" }, provider_token: "synthetic-access" } }, error: null });
    await callback(request("/auth/callback?code=synthetic-code", "bp_next=%2Fsettings%2Fsources"));
    expect(mocks.upsert.mock.calls[0][0]).not.toHaveProperty("refresh_token"); expect(mocks.encrypt).not.toHaveBeenCalled();
  });
  it("handles cancellation and invalid callback codes without losing the return destination", async () => {
    expect((await callback(request("/auth/callback?error=access_denied", "bp_next=%2Fonboarding"))).headers.get("location")).toBe("http://localhost:3000/onboarding?error=auth");
    mocks.exchange.mockResolvedValue({ data: { session: null }, error: new Error("expired") });
    expect((await callback(request("/auth/callback?code=expired", "bp_next=%2Fonboarding"))).headers.get("location")).toContain("/onboarding?error=auth"); expect(mocks.admin).not.toHaveBeenCalled();
  });
});
