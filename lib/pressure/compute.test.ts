import { describe, expect, it } from "vitest";
import type { LoadItem } from "@/lib/types";
import { computePressure, scoreFromRaw, zoneFor } from "./compute";
import { NOW, event, managerWeek, studentWeek, task } from "./__fixtures__/weeks";

const iso = (ms: number) => new Date(NOW.getTime() + ms).toISOString();
const HOUR = 36e5;

describe("computePressure", () => {
  it("empty week is 0 and cool", () => {
    const r = computePressure([], NOW);
    expect(r.score).toBe(0);
    expect(r.raw).toBe(0);
    expect(r.zone).toBe("cool");
    expect(r.contributions).toEqual([]);
    expect(r.counts).toEqual({ meetings: 0, meetingHours: 0, tasksDue: 0, overdue: 0 });
    expect(r.forecast).toHaveLength(7);
    expect(r.forecast.every((d) => d.score === 0)).toBe(true);
  });

  it("a typical student week (5 classes, 3 assignments) is 40 to 60", () => {
    const r = computePressure(studentWeek(), NOW);
    expect(r.score).toBeGreaterThanOrEqual(40);
    expect(r.score).toBeLessThanOrEqual(60);
  });

  it("a 25-meeting-hour manager week is 75 to 85", () => {
    const r = computePressure(managerWeek(), NOW);
    expect(r.counts.meetingHours).toBe(25);
    expect(r.score).toBeGreaterThanOrEqual(75);
    expect(r.score).toBeLessThanOrEqual(85);
  });

  it("score never exceeds 100", () => {
    const items: LoadItem[] = [];
    for (let d = 0; d < 7; d++) for (let h = 9; h < 21; h++) items.push(event(d, h, 1, "Crunch", { weight: "heavy", attendees: 20, isOrganizer: true }));
    for (let i = 0; i < 20; i++) items.push(task(`Overdue ${i}`, "L", -1));
    const r = computePressure(items, NOW);
    expect(r.score).toBe(100);
    expect(r.zone).toBe("redline");
    expect(r.forecast.every((d) => d.score <= 100)).toBe(true);
    expect(scoreFromRaw(1e9)).toBe(100);
  });

  it("focus time lowers the score", () => {
    const base = managerWeek();
    const focus = event(1, 8.5, 1, "Focus time", { release: true });
    const before = computePressure(base, NOW);
    const after = computePressure([...base, focus], NOW);
    expect(after.raw).toBeLessThan(before.raw);
    expect(after.score).toBeLessThanOrEqual(before.score);
    expect(after.contributions.find((c) => c.itemId === focus.id)?.points).toBeLessThan(0);
    // Releases are not meetings.
    expect(after.counts.meetings).toBe(before.counts.meetings);
  });

  it("completing a task lowers the score", () => {
    const essay = task("Essay", "L", 1);
    const others = studentWeek();
    const open = computePressure([...others, essay], NOW);
    const done = computePressure([...others, { ...essay, doneAt: iso(-HOUR) }], NOW);
    expect(done.score).toBeLessThan(open.score);
    expect(done.contributions.find((c) => c.itemId === essay.id)?.points).toBeLessThan(0);
    expect(done.counts.tasksDue).toBe(open.counts.tasksDue - 1);
  });

  it("completed-task release fades to 0 over 48h", () => {
    const t = task("Old", "M", -3);
    const fresh = computePressure([{ ...t, doneAt: iso(0) }], NOW).raw;
    const half = computePressure([{ ...t, doneAt: iso(-24 * HOUR) }], NOW).raw;
    const gone = computePressure([{ ...t, doneAt: iso(-49 * HOUR) }], NOW);
    expect(fresh).toBeCloseTo(-2);
    expect(half).toBeCloseTo(-1);
    expect(gone.raw).toBe(0);
    expect(gone.contributions).toEqual([]);
  });

  it("ignores ended events and events beyond 7 days; counts only the rest of an in-progress event", () => {
    const ended = event(-1, 9, 1, "Yesterday");
    const later = event(8, 9, 1, "Next week");
    expect(computePressure([ended, later], NOW).raw).toBe(0);

    const inProgress = event(0, 7, 2, "Started 7am"); // NOW is 8am, 1h left
    const r = computePressure([inProgress], NOW);
    expect(r.counts.meetingHours).toBe(1);
    expect(r.raw).toBeCloseTo(1);
  });

  it("applies weight, attendee, organizer and proximity factors", () => {
    const one = (extra: Partial<LoadItem>, day = 0) => computePressure([event(day, 9, 1, "x", extra)], NOW).raw;
    // start is 1h after NOW, so proximity ≈ 1 / (1 + 0.35/24)
    const p0 = 1 / (1 + 0.35 / 24);
    expect(one({})).toBeCloseTo(p0);
    expect(one({ isRecurring: true })).toBeCloseTo(0.25 * p0);
    expect(one({ isRecurring: true, weight: "heavy" })).toBeCloseTo(1.6 * p0);
    expect(one({ attendees: 25 })).toBeCloseTo(1.3 * p0);
    expect(one({ isOrganizer: true })).toBeCloseTo(1.2 * p0);
    expect(one({}, 2)).toBeCloseTo(1 / (1 + 0.35 * (2 + 1 / 24)));
  });

  it("task urgency: overdue and same-day cap at 3, no due date counts as 7 days out", () => {
    expect(computePressure([task("late", "S", -1)], NOW).raw).toBe(6);
    expect(computePressure([task("now", "S", 0, 9)], NOW).raw).toBe(6); // 1h away → floor 0.25 → 4 → cap 3
    expect(computePressure([task("2d", "M", 2, 8)], NOW).raw).toBeCloseTo(2);
    expect(computePressure([{ ...task("someday", "L", 0), due: undefined }], NOW).raw).toBeCloseTo(8 / 7);
    const r = computePressure([task("late", "S", -1), task("soon", "M", 3)], NOW);
    expect(r.counts).toMatchObject({ tasksDue: 1, overdue: 1 });
  });

  it("overdue tasks stop adding pressure after 14 days, and leave the counts", () => {
    expect(computePressure([task("13d late", "L", -13)], NOW).raw).toBe(24);
    const stale = computePressure([task("15d late", "L", -15)], NOW);
    expect(stale.raw).toBe(0);
    expect(stale.contributions).toEqual([]);
    expect(stale.counts.overdue).toBe(0);
  });

  it("a task due right now says so", () => {
    const r = computePressure([{ ...task("now", "S", 0), due: NOW.toISOString() }], NOW);
    expect(r.contributions[0]?.reason).toBe("S task, due now");
    expect(r.raw).toBe(6); // same 3× cap as overdue
  });

  it("writes human reasons and sorts contributions by size", () => {
    const review = event(0, 10, 2, "review", { weight: "heavy", attendees: 9 });
    const r = computePressure([event(0, 12, 0.5, "chat"), review, task("Essay", "M", 2)], NOW);
    expect(r.contributions[0].itemId).toBe(review.id);
    expect(r.contributions[0].reason).toBe("2h review, 9 people, Heavy");
    expect(r.contributions.map((c) => c.reason)).toContain("30m chat, Normal");
    expect(r.contributions.find((c) => c.title === "Essay")?.reason).toMatch(/^M task, due in 2\.6 days$/);
    const abs = r.contributions.map((c) => Math.abs(c.points));
    expect(abs).toEqual([...abs].sort((a, b) => b - a));
  });

  it("forecast: 7 days, day 0 equals now, later days drop past events", () => {
    const items = managerWeek();
    const r = computePressure(items, NOW);
    expect(r.forecast.map((d) => d.date)).toEqual([
      "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01",
    ]);
    expect(r.forecast[0].score).toBe(r.score);
    for (const d of r.forecast) expect(d.zone).toBe(zoneFor(d.score));
    // Saturday: the work week is over and its tasks are assumed done on time.
    expect(r.forecast[5].score).toBe(0);
  });

  it("forecast keeps tasks that are already overdue", () => {
    const r = computePressure([task("late", "S", -1)], NOW);
    expect(r.forecast.every((d) => d.score === r.score)).toBe(true);
  });

  it("forecast respects the time zone's day boundaries", () => {
    // 2026-10-26T08:00Z is 01:00 on Oct 26 in Los Angeles (PDT).
    const r = computePressure([], NOW, { timeZone: "America/Los_Angeles" });
    expect(r.forecast[0].date).toBe("2026-10-26");
    const tokyo = computePressure([], NOW, { timeZone: "Asia/Tokyo" }); // 17:00 Oct 26
    expect(tokyo.forecast[1].date).toBe("2026-10-27");
    // An event at 23:00Z Oct 26 is still ahead at Tokyo's day-1 start (Oct 26 15:00Z) and gone at day 2.
    const e = event(0, 23, 1, "late call");
    const f = computePressure([e], NOW, { timeZone: "Asia/Tokyo" }).forecast;
    expect(f[1].score).toBeGreaterThan(0);
    expect(f[2].score).toBe(0);
  });

  it("zones follow the thresholds", () => {
    expect([0, 39, 40, 69, 70, 89, 90, 100].map(zoneFor)).toEqual([
      "cool", "cool", "working", "working", "hot", "hot", "redline", "redline",
    ]);
  });
});
