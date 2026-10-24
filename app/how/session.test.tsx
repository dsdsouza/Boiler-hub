import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import HelpPage, { dynamic } from "./page";

const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser } }),
}));

const viewer = { email: "maya@example.test", user_metadata: { full_name: "Maya Chen" } };
const render = async () => renderToStaticMarkup(await HelpPage());

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://qa-project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "qa-anon-placeholder");
  getUser.mockReset().mockResolvedValue({ data: { user: null } });
});
afterEach(() => vi.unstubAllEnvs());

describe("Help session", () => {
  it("shows the verified account and app navigation with Help selected", async () => {
    getUser.mockResolvedValue({ data: { user: viewer } });
    const html = await render();
    const header = html.match(/<header[\s\S]*?<\/header>/)?.[0] ?? "";
    expect(header).toContain('aria-label="Signed in as Maya Chen"');
    expect(header).toContain('action="/auth/signout"');
    expect(header).toContain('method="post"');
    for (const href of ["/boiler", "/teams", "/settings/sources"]) {
      expect(header).toContain(`href="${href}"`);
    }
    const helpLink = header.match(/<a\b[^>]*href="\/how"[^>]*>Help<\/a>/)?.[0];
    expect(helpLink).toContain('aria-current="page"');
    expect(header).not.toContain("Sign in with Google");
    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it("offers guests sign-in that returns to Help and keeps the shared navigation", async () => {
    const html = await render();
    const header = html.match(/<header[\s\S]*?<\/header>/)?.[0] ?? "";
    expect(header).toContain('/auth/signin?next=%2Fhow');
    for (const href of ["/boiler", "/teams", "/settings/sources"]) {
      expect(header).toContain(`href="${href}"`);
    }
    expect(header).not.toContain("Sign out");
    expect(html).toContain("Pressure tracks the work still ahead.");
  });

  it("checks each request instead of reusing the previous viewer", async () => {
    expect(dynamic).toBe("force-dynamic");
    getUser.mockResolvedValueOnce({ data: { user: viewer } });
    expect(await render()).toContain("Signed in as Maya Chen");
    const nextRequest = await render();
    expect(nextRequest).not.toContain("Signed in as Maya Chen");
    expect(nextRequest).toContain("Sign in with Google");
    expect(getUser).toHaveBeenCalledTimes(2);
  });

  it("keeps Help readable with guest controls if session verification fails", async () => {
    getUser.mockRejectedValue(new Error("Auth unavailable"));
    const html = await render();
    expect(html).toContain("Sign in with Google");
    expect(html).not.toContain("Sign out");
    expect(html).toContain("Pressure tracks the work still ahead.");
  });

  it("remains available when authentication is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const html = await render();
    expect(html).toContain("Sign in with Google");
    expect(getUser).not.toHaveBeenCalled();
  });
});
