import { describe, expect, it } from "vitest";
import type { LoadItem } from "@/lib/types";
import { computePressure, forecastBreakdown } from "./compute";

const now = new Date("2026-10-31T16:00:00Z");
const items: LoadItem[] = [
  ...[1, 2].map((n): LoadItem => ({ id: `exam-${n}`, kind: "task", source: "manual", title: `Midterm exam ${n}`, size: "L", due: "2026-11-05T16:00:00Z" })),
  ...[1, 2, 3].map((n): LoadItem => ({ id: `project-${n}`, kind: "task", source: "manual", title: `Project ${n}`, size: "L", due: "2026-11-02T05:00:00Z" })),
  { id: "earlier", kind: "task", source: "manual", title: "Due before the forecast day", size: "M", due: "2026-11-01T02:00:00Z" },
  { id: "overdue", kind: "task", source: "manual", title: "Unfinished backlog", size: "S", due: "2026-10-30T16:00:00Z" },
  { id: "done", kind: "task", source: "manual", title: "Already completed", size: "L", due: "2026-11-02T05:00:00Z", doneAt: "2026-10-30T16:00:00Z" },
  { id: "event", kind: "event", source: "google", title: "Planning", start: "2026-11-02T14:00:00Z", end: "2026-11-02T16:00:00Z", weight: "heavy" },
];

describe("forecast explanations", () => {
  it.each(["UTC", "America/New_York", "Asia/Tokyo"])("matches every forecast score and zone across DST in %s", (timeZone) => {
    const result = computePressure(items, now, { timeZone });
    for (const day of result.forecast) {
      const explanation = forecastBreakdown(items, now, day.date, { timeZone });
      expect(explanation?.score).toBe(day.score);
      expect(explanation?.zone).toBe(day.zone);
    }
    expect(forecastBreakdown(items, now, result.forecast[0].date, { timeZone })?.contributions).toEqual(result.contributions);
  });

  it("explains a redline using upcoming deadlines and overdue work, with the selected day's points", () => {
    const options = { timeZone: "America/New_York" };
    const current = computePressure(items, now, options);
    const day = forecastBreakdown(items, now, "2026-11-01", options)!;
    expect(day.zone).toBe("redline");
    expect(day.contributions.map((c) => c.itemId)).toEqual(expect.arrayContaining(["project-1", "overdue", "event"]));
    expect(day.contributions.map((c) => c.itemId)).not.toContain("earlier");
    expect(day.contributions.map((c) => c.itemId)).not.toContain("done");
    expect(day.contributions.find((c) => c.itemId === "project-1")!.points).toBeGreaterThan(current.contributions.find((c) => c.itemId === "project-1")!.points);
    expect(day.contributions.find((c) => c.itemId === "overdue")!.reason).toContain("overdue");
  });

  it("removes completed causes and returns an empty breakdown for an empty day", () => {
    const empty = forecastBreakdown([], now, "2026-11-01");
    expect(empty).toMatchObject({ score: 0, zone: "cool", contributions: [] });
    const completed = items.map((i) => i.kind === "task" ? { ...i, doneAt: now.toISOString() } : i);
    expect(forecastBreakdown(completed, now, "2026-11-01")!.contributions.every((c) => c.itemId === "event")).toBe(true);
    expect(forecastBreakdown(items, now, "2026-12-01")).toBeNull();
  });
});
