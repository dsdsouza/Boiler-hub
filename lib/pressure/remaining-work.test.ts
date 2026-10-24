import { describe, expect, it } from "vitest";
import type { LoadItem } from "@/lib/types";
import { computePressure } from "./compute";
import { applyTaskToRaw } from "./preview";

const NOW = new Date("2026-10-24T12:00:00Z");
const DAY = 86_400_000;
const task = (id: string, days: number, extra: Partial<LoadItem> = {}): LoadItem => ({ id, kind: "task", source: "ics", title: id, size: "M", due: new Date(NOW.getTime() + days * DAY).toISOString(), ...extra });

describe("remaining workload", () => {
  it("finishing a backlog cannot cancel ten assignments still due", () => {
    const pending = Array.from({ length: 10 }, (_, i) => task(`pending-${i}`, 5));
    const finished = Array.from({ length: 20 }, (_, i) => task(`finished-${i}`, -1, { doneAt: NOW.toISOString() }));
    const expected = computePressure(pending, NOW);
    const actual = computePressure([...pending, ...finished], NOW);
    expect(actual.score).toBe(expected.score);
    expect(actual.raw).toBe(expected.raw);
    expect(actual.counts.tasksDue).toBe(10);
    expect(actual.score).toBeGreaterThan(50);
    expect(actual.contributions.every((c) => c.points > 0)).toBe(true);
  });

  it("calendar focus and time off do not erase pending assignments", () => {
    const pending = [task("exam", 1, { size: "L" })];
    const free: LoadItem = { id: "ooo", kind: "event", source: "google", title: "Out of office", start: NOW.toISOString(), end: new Date(NOW.getTime() + 7 * DAY).toISOString(), release: true };
    expect(computePressure([...pending, free], NOW).score).toBe(computePressure(pending, NOW).score);
  });

  it("old overdue work remains counted until the owner marks it done", () => {
    const result = computePressure([task("unsubmitted", -30)], NOW);
    expect(result.score).toBeGreaterThan(0);
    expect(result.counts.overdue).toBe(1);
    expect(result.contributions[0]?.points).toBeGreaterThan(0);
    expect(result.contributions[0]?.points).toBeLessThan(computePressure([task("recent", -1)], NOW).raw);
  });

  it("includes preparation for deadlines in the next two weeks", () => {
    const result = computePressure([task("next-week", 10)], NOW);
    expect(result.score).toBeGreaterThan(0);
    expect(result.counts.tasksDue).toBe(1);
    expect(result.forecast[0].score).toBe(result.score);
  });

  it("uses the same task horizon for assignment previews and the engine", () => {
    for (const days of [1, 7, 10, 14, 15, 30]) {
      const item = task(`due-${days}`, days);
      const direct = computePressure([item], NOW);
      const preview = applyTaskToRaw(0, { due: item.due!, size: "M" }, NOW);
      expect(preview.score).toBe(direct.score);
      if (days > 14) expect(direct.score).toBe(0);
    }
  });
});
