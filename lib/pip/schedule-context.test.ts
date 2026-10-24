import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ admin: vi.fn(), token: vi.fn(), calendar: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/google/client", () => ({ getAccessToken: mocks.token, GoogleReconnectError: class extends Error {} }));
vi.mock("@/lib/google/calendar", () => ({ fetchPrimaryEvents: mocks.calendar }));
import { scheduleContext } from "./schedule-context";
import { GoogleReconnectError } from "@/lib/google/client";
beforeEach(() => { vi.resetAllMocks(); mocks.admin.mockReturnValue("admin"); mocks.token.mockResolvedValue("secret-token"); });
const now = new Date("2026-10-26T12:00:00Z");
it("loads only the verified caller's calendar and exposes time windows without event contents", async () => {
  mocks.calendar.mockResolvedValue({ timeZone: "America/New_York", events: [{ id: "private", summary: "Confidential appointment", start: { dateTime: "2026-10-26T13:00:00Z" }, end: { dateTime: "2026-10-26T15:00:00Z" } }, { id: "declined", attendees: [{ self: true, responseStatus: "declined" }], start: { dateTime: "2026-10-26T15:00:00Z" }, end: { dateTime: "2026-10-26T16:00:00Z" } }] });
  const result = await scheduleContext("verified-owner", "America/New_York", [], now);
  expect(mocks.token).toHaveBeenCalledWith("admin", "verified-owner", now);
  expect(result.state).toBe("connected");
  expect(result.windows[0].startsAt).toBe("2026-10-26T15:00:00.000Z");
  expect(JSON.stringify(result)).not.toMatch(/Confidential|secret-token|private/);
});
it("never presents missing calendar access as verified availability", async () => {
  mocks.token.mockRejectedValue(new GoogleReconnectError("Reconnect"));
  expect((await scheduleContext("owner", "UTC", [], now)).state).toBe("disconnected");
});
