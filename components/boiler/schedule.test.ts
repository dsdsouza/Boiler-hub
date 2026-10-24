import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { LoadItem } from "@/lib/types";
import type { BoilerResponse, SourceInfo } from "@/lib/pressure/api-types";
import { classifyIcs } from "@/lib/sources/ics";
import { toMyBoilerData } from "./fromApi";
import { scheduleDays } from "./schedule";

const ID = "11111111-1111-4111-8111-111111111111";
const sources: SourceInfo[] = [{ id: ID, kind: "ics", label: "Brightspace", coursework: true, status: "ok", error: null, lastSyncedAt: null }];
const NOW = new Date("2026-10-26T08:00:00");
const event = (key: string, start: string, end: string, extra: Partial<LoadItem> = {}): LoadItem => ({
  id: `${ID}:${key}`, kind: "event", source: "ics", title: key, start, end, ...extra,
});

describe("class schedule", () => {
  it("shows coursework events in time order and keeps personal events and tasks out", () => {
    const days = scheduleDays([
      event("afternoon", "2026-10-26T15:00:00", "2026-10-26T16:00:00"),
      event("morning", "2026-10-26T09:00:00", "2026-10-26T10:00:00"),
      event("ended", "2026-10-26T07:00:00", "2026-10-26T08:00:00"),
      event("personal", "2026-10-26T09:00:00", "2026-10-26T10:00:00", { id: "google-event", source: "google" }),
      event("due", "2026-10-26T09:00:00", "2026-10-26T10:00:00", { kind: "task" }),
      event("broken", "invalid", "invalid"),
    ], sources, NOW);
    expect(days).toHaveLength(7);
    expect(days[0]!.entries.map((e) => e.item.title)).toEqual(["morning", "afternoon"]);
    expect(days[1]!.entries).toEqual([]);
    expect(days[0]!.entries[0]!.sourceLabel).toBe("Brightspace");
  });

  it("does not show unavailable or non-coursework sources as classes", () => {
    const items = [event("lecture", "2026-10-26T09:00:00", "2026-10-26T10:00:00")];
    for (const overrides of [{ coursework: false }, { status: "error" as const }, { kind: "github" as const }]) {
      expect(scheduleDays(items, [{ ...sources[0]!, ...overrides }], NOW).every((d) => d.entries.length === 0)).toBe(true);
    }
  });

  it("places an ongoing overnight class on each day it overlaps", () => {
    const days = scheduleDays([event("overnight", "2026-10-26T23:00:00", "2026-10-27T01:00:00")], sources, NOW);
    expect(days.slice(0, 3).map((d) => d.entries.length)).toEqual([1, 1, 0]);
  });

  it("keeps seven distinct local dates across the daylight-saving transition", () => {
    const days = scheduleDays([], sources, new Date("2026-10-30T12:00:00"));
    expect(days.map((d) => d.key)).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"]);
    expect(days.every((d) => d.date.getHours() === 0)).toBe(true);
  });

  it("carries recurring Brightspace classes from the feed through the API mapping into the schedule", () => {
    const feed = readFileSync(join(__dirname, "../../lib/sources/__fixtures__/brightspace.ics"), "utf8");
    const now = new Date("2026-10-26T12:00:00Z");
    const items = classifyIcs(feed, { sourceId: ID, coursework: true, now, timeZone: "America/New_York" });
    const response: BoilerResponse = {
      result: { score: 0, raw: 0, zone: "cool", contributions: [], forecast: [], counts: { meetings: 0, meetingHours: 0, tasksDue: 0, overdue: 0 } },
      events: items.filter((i) => i.kind === "event").map((i) => ({
        id: i.id, title: i.title, start: i.start!, end: i.end!, weight: "normal", override: null,
        seriesKey: i.seriesKey!, isRecurring: !!i.isRecurring, release: false,
      })),
      tasks: [], status: { status: "open", note: null }, calendar: "reconnect", sources, computedAt: now.toISOString(),
    };
    const data = toMyBoilerData(response);
    expect(data.items.every((i) => i.source === "ics")).toBe(true);
    const lectures = scheduleDays(data.items, data.sources!, now).flatMap((d) => d.entries).filter((e) => e.item.title === "BIO 101 Lecture");
    expect(lectures.map((e) => e.item.start)).toEqual(["2026-10-26T15:00:00.000Z", "2026-10-30T15:00:00.000Z"]);
    expect(lectures.every((e) => e.item.isRecurring)).toBe(true);
  });
});
