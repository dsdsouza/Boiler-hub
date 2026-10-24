import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import LandingPage, { dynamic } from "./page";

const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser } }),
}));

const viewer = { email: "maya@example.test", user_metadata: { full_name: "Maya Chen" } };

async function render(params: Record<string, string> = {}) {
  return renderToStaticMarkup(await LandingPage({ searchParams: Promise.resolve(params) }));
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://qa-project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "qa-anon-placeholder");
  getUser.mockReset().mockResolvedValue({ data: { user: null } });
});
afterEach(() => vi.unstubAllEnvs());

describe("landing session", () => {
  it("offers Google sign-in when signed out and preserves the return destination", async () => {
    const html = await render({ next: "/settings/sources" });
    expect(html.match(/Sign in with Google/g)).toHaveLength(2);
    expect(html).toContain('/auth/signin?next=%2Fsettings%2Fsources');
    expect(html).not.toContain("Sign out");
    expect(html).not.toContain("Open My Boiler");
  });

  it("shows the verified account and boiler link instead of Google sign-in", async () => {
    getUser.mockResolvedValue({ data: { user: viewer } });
    const html = await render();
    expect(html).toContain('aria-label="Signed in as Maya Chen"');
    expect(html).toContain('action="/auth/signout"');
    expect(html).toContain('method="post"');
    expect(html).toContain("Sign out");
    expect(html).toContain('href="/boiler"');
    expect(html).toContain("Open My Boiler");
    expect(html).not.toContain("Sign in with Google");
    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it("does not tell a signed-in viewer to sign in again", async () => {
    getUser.mockResolvedValue({ data: { user: viewer } });
    const html = await render({ next: "/teams", error: "signin" });
    expect(html).not.toContain("Sign in to open that page.");
    expect(html).not.toContain("Sign-in did not finish.");
    expect(html).toContain("Open My Boiler");
  });

  it("checks each request without sharing the previous viewer", async () => {
    expect(dynamic).toBe("force-dynamic");
    getUser.mockResolvedValueOnce({ data: { user: viewer } });
    expect(await render()).toContain("Signed in as Maya Chen");
    const nextRequest = await render();
    expect(nextRequest).not.toContain("Signed in as Maya Chen");
    expect(nextRequest).toContain("Sign in with Google");
  });

  it("falls back to signed-out controls if session verification fails", async () => {
    getUser.mockRejectedValue(new Error("Auth unavailable"));
    const html = await render();
    expect(html).toContain("Sign in with Google");
    expect(html).not.toContain("Sign out");
  });
});
