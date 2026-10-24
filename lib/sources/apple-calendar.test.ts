import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { computePressure } from "@/lib/pressure/compute";
import { defaultFeedLabel, isAppleCalendarUrl, isCourseworkUrl } from "./hints";
import { classifyIcs, icsAdapter } from "./ics";
import { parseFeedUrl } from "./fetch";

vi.mock("node:dns/promises", () => ({ lookup: async () => [{ address: "93.184.216.34", family: 4 }] }));

const FEED = readFileSync(join(__dirname, "__fixtures__", "icloud.ics"), "utf8");
const SOURCE = "33333333-3333-4333-8333-333333333333";
const NOW = new Date("2026-10-26T12:00:00Z");
const LINK = "webcal://p123-caldav.icloud.com/published/2/example-calendar-token";
const classify = (text = FEED) => classifyIcs(text, { sourceId: SOURCE, coursework: false, now: NOW, timeZone: "UTC" });

describe("Apple Calendar links", () => {
  it.each([LINK, LINK.replace("webcal:", "https:"), LINK.replace("webcal:", "webcals:"), `  ${LINK}  `])(
    "recognizes a published iCloud link and names it (%s)", (url) => {
      expect(isAppleCalendarUrl(url)).toBe(true);
      expect(defaultFeedLabel(url)).toBe("Apple Calendar");
      expect(isCourseworkUrl(url)).toBe(false);
      expect(parseFeedUrl(url).href).toBe(LINK.replace("webcal:", "https:"));
    },
  );

  it.each([
    "https://www.icloud.com/calendar/",
    "https://p123-caldav.icloud.com.evil.example/published/2/token",
    "https://evil.example/published/2/token?p=p123-caldav.icloud.com",
    "https://p123-caldav.icloud.com/private/token",
    "not a url",
  ])("does not mistake another URL for a published iCloud feed (%s)", (url) => {
    expect(isAppleCalendarUrl(url)).toBe(false);
    expect(defaultFeedLabel(url)).toBe("Calendar feed");
  });
});

describe("iCloud event ingestion (synthetic Apple-format fixture)", () => {
  it("expands repeat events across DST, exclusions and rescheduled occurrences", () => {
    const events = classify().filter((i) => i.isRecurring);
    expect(events.map((i) => i.start).sort()).toEqual([
      "2026-10-26T13:00:00.000Z",
      "2026-10-27T13:00:00.000Z",
      "2026-10-29T15:00:00.000Z",
      "2026-10-30T13:00:00.000Z",
      "2026-10-31T13:00:00.000Z",
      "2026-11-01T14:00:00.000Z",
      "2026-11-02T14:00:00.000Z",
    ].filter((s) => Date.parse(s) < NOW.getTime() + 7 * 86_400_000));
    expect(events.find((i) => i.title === "Rescheduled check-in")?.end).toBe("2026-10-29T16:00:00.000Z");
    expect(new Set(events.map((i) => i.seriesKey)).size).toBe(1);
    expect(new Set(events.map((i) => i.itemKey)).size).toBe(events.length);
  });

  it("reads DURATION and escaped titles, and ignores all-day, free and cancelled meetings", () => {
    const items = classify();
    expect(items.find((i) => i.title === "Planning, review and next steps")).toMatchObject({
      kind: "event", source: "ics", start: "2026-10-27T18:00:00.000Z", end: "2026-10-27T19:00:00.000Z",
    });
    for (const title of ["Birthday", "Optional catch-up", "Cancelled catch-up"]) {
      expect(items.some((i) => i.title === title)).toBe(false);
    }
    expect(items.find((i) => i.title === "Assignment due")).toMatchObject({
      kind: "task", due: "2026-11-02T04:59:00.000Z", size: "S",
    });
    const result = computePressure(items, NOW);
    expect(result.counts).toMatchObject({ meetings: 7, meetingHours: 4.5, tasksDue: 1 });
    expect(result.score).toBeGreaterThan(0);
  });

  it("fetches the normalized iCloud link through the existing read-only adapter", async () => {
    // Synthetic DNS and HTTP responses keep the test independent of Apple's service.
    const fetchImpl = vi.fn(async () => new Response(FEED, { headers: { "content-type": "text/calendar" } }));
    const items = await icsAdapter.fetchItems(
      { id: SOURCE, kind: "ics", label: "Apple Calendar", coursework: false, secret: parseFeedUrl(LINK).href },
      { now: NOW, timeZone: "UTC", fetchImpl },
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.objectContaining({ protocol: "https:", hostname: "p123-caldav.icloud.com" }),
      expect.objectContaining({ redirect: "manual", cache: "no-store" }),
    );
    expect(items).toEqual(classify());
  });
});
