import { describe, expect, it } from "vitest";
import { zoneOf } from "@/components/ui/zones";
import * as S from "./boilerState";
import { mayaBoiler, demoTeams } from "./fixture";
import { boilerVisuals, fireFromForecast, needleAngle, steamParams } from "./geometry";
import { applyTaskToRaw, rawFromScore, scoreFromRaw, taskUrgency } from "./localPressure";
import { countsLine, forecastCaption, formatPoints, weekday } from "./format";

const NOW = new Date("2026-10-24T12:00:00");

describe("localPressure", () => {
  it("maps raw to score and back", () => {
    expect(scoreFromRaw(0)).toBe(0);
    expect(scoreFromRaw(33.68)).toBe(74);
    expect(scoreFromRaw(1e6)).toBe(100);
    expect(scoreFromRaw(rawFromScore(62))).toBe(62);
    expect(Number.isFinite(rawFromScore(100))).toBe(true);
  });

  it("caps urgency at 3 and treats overdue as 3", () => {
    expect(taskUrgency("2026-10-24T13:00:00", NOW)).toBe(3);
    expect(taskUrgency("2026-10-20T12:00:00", NOW)).toBe(3);
    expect(taskUrgency("2026-10-26T12:00:00", NOW)).toBeCloseTo(0.5);
  });

  it("applyTaskToRaw only ever raises pressure", () => {
    for (const team of demoTeams) {
      for (const b of team.boilers) {
        const after = applyTaskToRaw(b.raw, { due: "2026-10-25T17:00:00", size: "L" }, NOW);
        expect(after.score).toBeGreaterThanOrEqual(b.score);
        expect(after.zone).toBe(zoneOf(after.score));
      }
    }
  });
});

describe("boilerState", () => {
  const base = () => mayaBoiler(NOW);

  it("fixture items cover every contribution", () => {
    const d = base();
    const ids = new Set(d.items.map((i) => i.id));
    for (const c of d.result.contributions) expect(ids.has(c.itemId)).toBe(true);
    expect(d.result.score).toBe(74);
    expect(d.result.forecast[0]!.date).toBe("2026-10-24");
  });

  it("completing a task vents steam and drops the needle", () => {
    const d = base();
    const { data, vented } = S.setTaskDone(d, "tsk-onboarding-spec", true, NOW);
    expect(vented).toBeGreaterThan(6);
    expect(data.result.score).toBeLessThan(d.result.score);
    expect(data.items.find((i) => i.id === "tsk-onboarding-spec")!.doneAt).toBeTruthy();
    const c = data.result.contributions.find((x) => x.itemId === "tsk-onboarding-spec")!;
    expect(c.points).toBeLessThan(0);
  });

  it("reopening a task restores pressure", () => {
    const done = S.setTaskDone(base(), "tsk-pr-reviews", true, NOW).data;
    const reopened = S.setTaskDone(done, "tsk-pr-reviews", false, NOW).data;
    expect(reopened.result.score).toBeGreaterThan(done.result.score);
  });

  it("adding a task raises the score and appears in the list", () => {
    const d = S.addTask(base(), { title: "Draft lab report", due: "2026-10-25T17:00:00", size: "L" }, "t1", NOW);
    expect(d.result.score).toBeGreaterThan(74);
    expect(d.items.some((i) => i.id === "t1")).toBe(true);
    expect(d.result.contributions.find((c) => c.itemId === "t1")!.reason).toMatch(/^Task L, due tomorrow$/);
  });

  it("retagging an event scales its points and rewrites the reason", () => {
    const d = S.setEventWeight(base(), "evt-design-review", "light", false);
    const c = d.result.contributions.find((x) => x.itemId === "evt-design-review")!;
    expect(c.points).toBeCloseTo((7.2 * 0.5) / 1.6, 2);
    expect(c.reason).toContain("Light");
    expect(d.items.find((i) => i.id === "evt-design-review")!.weight).toBe("light");
    expect(d.result.score).toBeLessThan(74);
  });

  it("status note is capped at 80 characters and never moves the score", () => {
    const d = S.setStatus(base(), "running_hot", "x".repeat(120));
    expect(d.statusNote).toHaveLength(80);
    expect(d.result.score).toBe(74);
  });
});

describe("geometry", () => {
  it("needle sweeps 240 degrees", () => {
    expect(needleAngle(0)).toBe(-120);
    expect(needleAngle(100)).toBe(120);
    expect(needleAngle(150)).toBe(120);
  });

  it("shakes only at Hot and Redline, harder at Redline", () => {
    expect(boilerVisuals(30, "cool").shake).toBeNull();
    expect(boilerVisuals(60, "working").shake).toBeNull();
    const hot = boilerVisuals(80, "hot").shake!;
    const red = boilerVisuals(95, "redline").shake!;
    expect(Math.max(...red.x)).toBeGreaterThan(Math.max(...hot.x));
    expect(boilerVisuals(95, "redline").crack).toBe(true);
  });

  it("steam and bubbles rise with the score", () => {
    const a = steamParams(20, "cool");
    const b = steamParams(60, "working");
    const c = steamParams(95, "redline");
    expect(b.puffRate).toBeGreaterThan(a.puffRate);
    expect(c.puffRate).toBeGreaterThan(b.puffRate);
    expect(a.bubbleRate).toBe(0);
    expect(c.bubbleRate).toBeGreaterThan(b.bubbleRate);
    expect(c.burst).toBe(true);
  });

  it("firebox is brighter for heavy weeks", () => {
    expect(fireFromForecast([90, 90, 85, 80, 70, 60, 50])).toBeGreaterThan(fireFromForecast([20, 20, 15, 10, 10, 5, 5]));
  });
});

describe("format", () => {
  it("formats points, weekdays and counts", () => {
    expect(formatPoints(7.2)).toBe("+7.2");
    expect(formatPoints(-1.62)).toBe("−1.6");
    expect(weekday("2026-10-24")).toBe("Sat");
    expect(countsLine({ meetings: 14, meetingHours: 16.5, tasksDue: 4, overdue: 1 })).toBe("14 meetings · 16.5 h · 4 due · 1 overdue");
    expect(countsLine({ meetings: 25, meetingHours: 25, tasksDue: 0, overdue: 0 }, "class")).toBe("25 classes · 25 h · 0 due");
  });

  it("captions the forecast by its hottest coming day", () => {
    expect(forecastCaption(mayaBoiler(NOW).result.forecast)).toBe("Sunday is already lit");
  });
});
