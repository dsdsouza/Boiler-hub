import ical from "node-ical";
import { describe, expect, it } from "vitest";
import { deadlineCalendar } from "./ical";
import { subscriptionLinks } from "./links";

const now = new Date("2026-10-24T16:00:00Z");
const deadline = { id: "task-1", title: "Submit draft", dueAt: "2026-10-26T21:00:00Z" };

describe("outbound calendar subscriptions", () => {
  it("round-trips timed deadlines as transparent events with stable identities", () => {
    const feed = deadlineCalendar([deadline], now);
    const event = ical.sync.parseICS(feed)["task-1@deadlines.boilerhub.work"];
    expect(event).toMatchObject({ type: "VEVENT", summary: "Submit draft", transparency: "TRANSPARENT" });
    if (event?.type !== "VEVENT") throw new Error("Missing event");
    expect(event.start.toISOString()).toBe(deadline.dueAt.replace("Z", ".000Z"));
    expect(event.end?.toISOString()).toBe("2026-10-26T21:01:00.000Z");
    const moved = ical.sync.parseICS(deadlineCalendar([{ ...deadline, dueAt: "2026-10-27T21:00:00Z" }], now));
    expect(moved["task-1@deadlines.boilerhub.work"]?.type).toBe("VEVENT");
    expect(feed).toContain("X-WR-CALNAME:Boilerplate deadlines\r\n");
  });

  it("escapes feed injection and folds long Unicode titles without corrupting text", () => {
    const title = "Review 🧪 漢字, draft; \\ next\r\nBEGIN:VEVENT\n".repeat(5);
    const feed = deadlineCalendar([{ ...deadline, title }], now);
    expect(feed.match(/^BEGIN:VEVENT$/gm)).toHaveLength(1);
    expect(feed.split("\r\n").every((line) => Buffer.byteLength(line, "utf8") <= 75)).toBe(true);
    expect(ical.sync.parseICS(feed)["task-1@deadlines.boilerhub.work"]).toMatchObject({ summary: title.replace(/\r\n/g, "\n") });
  });

  it("returns a valid empty calendar and excludes invalid dates", () => {
    const feed = deadlineCalendar([{ ...deadline, dueAt: "invalid" }], now);
    expect(feed).not.toContain("BEGIN:VEVENT");
    expect(feed.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ical.sync.parseICS(feed).vcalendar?.type).toBe("VCALENDAR");
  });

  it("builds a real webcal link on the current origin, rejecting arbitrary destinations", () => {
    const path = `/api/calendar/feed/${"a".repeat(64)}.ics`;
    expect(subscriptionLinks(path, "https://boilerhub.work")).toEqual({
      https: `https://boilerhub.work${path}`, webcal: `webcal://boilerhub.work${path}`,
    });
    expect(subscriptionLinks(path, "http://localhost:3004").webcal).toBe(`webcal://localhost:3004${path}`);
    expect(() => subscriptionLinks("https://evil.example/feed", "https://boilerhub.work")).toThrow();
    expect(() => subscriptionLinks(path, "file:///tmp")).toThrow();
  });
});
