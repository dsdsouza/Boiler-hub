import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/crypto", () => ({ decrypt: (s: string) => `plain:${s}` }));

const { getAccessToken, GoogleReconnectError } = await import("./client");
const { fetchPrimaryEvents } = await import("./calendar");

const NOW = new Date("2026-10-26T08:00:00Z");

/** Minimal stand-in for the admin client's google_tokens queries. */
function fakeAdmin(row: Record<string, unknown> | null) {
  const updates: Record<string, unknown>[] = [];
  const admin = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }),
      update: (patch: Record<string, unknown>) => {
        updates.push(patch);
        return { eq: async () => ({ error: null }) };
      },
    }),
  } as unknown as SupabaseClient;
  return { admin, updates };
}

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("GOOGLE_CLIENT_ID", "id");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "secret");
});
afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("getAccessToken", () => {
  it("returns the stored token when it is not near expiry", async () => {
    const { admin, updates } = fakeAdmin({
      access_token: "live",
      refresh_token: "enc",
      expires_at: new Date(NOW.getTime() + 30 * 60e3).toISOString(),
    });
    expect(await getAccessToken(admin, "u1", NOW)).toBe("live");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(updates).toEqual([]);
  });

  it("refreshes within 5 minutes of expiry and saves the new token", async () => {
    const { admin, updates } = fakeAdmin({
      access_token: "old",
      refresh_token: "enc",
      expires_at: new Date(NOW.getTime() + 4 * 60e3).toISOString(),
    });
    fetchMock.mockResolvedValueOnce(json({ access_token: "fresh", expires_in: 3599 }));

    expect(await getAccessToken(admin, "u1", NOW)).toBe("fresh");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    const body = new URLSearchParams(String(init.body));
    expect(body.get("refresh_token")).toBe("plain:enc");
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(updates[0]).toMatchObject({
      access_token: "fresh",
      expires_at: new Date(NOW.getTime() + 3599e3).toISOString(),
    });
  });

  it("asks for reconnect when there is no row, no refresh token, or invalid_grant", async () => {
    await expect(getAccessToken(fakeAdmin(null).admin, "u1", NOW)).rejects.toBeInstanceOf(GoogleReconnectError);
    await expect(
      getAccessToken(fakeAdmin({ access_token: null, refresh_token: null, expires_at: null }).admin, "u1", NOW),
    ).rejects.toBeInstanceOf(GoogleReconnectError);

    fetchMock.mockResolvedValueOnce(json({ error: "invalid_grant", error_description: "Token has been expired or revoked." }, 400));
    await expect(
      getAccessToken(fakeAdmin({ access_token: null, refresh_token: "enc", expires_at: null }).admin, "u1", NOW),
    ).rejects.toBeInstanceOf(GoogleReconnectError);
  });

  it("throws a plain error on other refresh failures", async () => {
    fetchMock.mockResolvedValueOnce(json({ error: "server_error" }, 500));
    const err = await getAccessToken(fakeAdmin({ access_token: null, refresh_token: "enc", expires_at: null }).admin, "u1", NOW).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(GoogleReconnectError);
  });
});

describe("fetchPrimaryEvents", () => {
  it("requests now..now+7d with singleEvents, follows pages and returns the time zone", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ items: [{ id: "a" }], nextPageToken: "p2", timeZone: "America/New_York" }))
      .mockResolvedValueOnce(json({ items: [{ id: "b" }], timeZone: "America/New_York" }));

    const week = await fetchPrimaryEvents("tok", NOW);
    expect(week.events.map((e) => e.id)).toEqual(["a", "b"]);
    expect(week.timeZone).toBe("America/New_York");

    const first = new URL(fetchMock.mock.calls[0][0]);
    expect(first.pathname).toBe("/calendar/v3/calendars/primary/events");
    expect(first.searchParams.get("timeMin")).toBe("2026-10-26T08:00:00.000Z");
    expect(first.searchParams.get("timeMax")).toBe("2026-11-09T08:00:00.000Z");
    expect(first.searchParams.get("singleEvents")).toBe("true");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer tok");
    expect(new URL(fetchMock.mock.calls[1][0]).searchParams.get("pageToken")).toBe("p2");
  });

  it("maps 401 to reconnect", async () => {
    fetchMock.mockResolvedValueOnce(json({}, 401));
    await expect(fetchPrimaryEvents("tok", NOW)).rejects.toBeInstanceOf(GoogleReconnectError);
  });
});
