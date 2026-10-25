import { describe, expect, it } from "vitest";
import type { LoadItem } from "@/lib/types";
import { computePressure } from "@/lib/pressure";
import { ORGANIZER_FACTOR, WINDOW_DAYS } from "@/lib/pressure/config";
import { explainForecastDay, type EventContributor, type TaskContributor } from "./explain";
import { forecastInstant } from "./dayStart";
import { SCENARIOS } from "./fixtures";
import { assumptionLines, coverageText, eventFormula, pipLine, taskFormula } from "./wording";

const scenario = (id: string) => SCENARIOS.find((s) => s.id === id)!;
const midterm = scenario("midterm-week");
const now = new Date(midterm.now);
const opts = { timeZone: midterm.timeZone, eventsLoadedThrough: midterm.eventsLoadedThrough };
const explain = (i: number, items: LoadItem[] = midterm.items, o = opts) => explainForecastDay(items, now, i, o);

describe("explainForecastDay matches the engine's forecast", () => {
  for (const s of SCENARIOS) {
    for (const timeZone of [s.timeZone, "UTC", "Asia/Kolkata", "Pacific/Auckland"]) {
      it(`${s.id} in ${timeZone}`, () => {
        const at = new Date(s.now);
        const forecast = computePressure(s.items, at, { timeZone }).forecast;
        for (let i = 0; i < WINDOW_DAYS; i++) {
          const e = explainForecastDay(s.items, at, i, { timeZone });
          expect(e.date).toBe(forecast[i]!.date);
          expect(e.score).toBe(forecast[i]!.score);
          expect(e.zone).toBe(forecast[i]!.zone);
        }
      });
    }
  }

  it("day 0 equals the live score", () => {
    const live = computePressure(midterm.items, now, { timeZone: midterm.timeZone });
    const e = explain(0);
    expect(e.score).toBe(live.score);
    expect(e.contributors.map((c) => c.id)).toEqual(live.contributions.map((c) => c.itemId));
  });

  it("raw is the sum of contributor points", () => {
    for (let i = 0; i < WINDOW_DAYS; i++) {
      const e = explain(i);
      expect(e.contributors.reduce((s, c) => s + c.points, 0)).toBeCloseTo(e.raw, 1);
    }
  });

  it("scores later days at local midnight across the fall-back change", () => {
    // Sunday 1 Nov starts at 04:00Z (EDT); Monday 2 Nov at 05:00Z (EST).
    expect(forecastInstant(now, 6, "America/New_York").at.toISOString()).toBe("2026-11-01T04:00:00.000Z");
    expect(explain(6).date).toBe("2026-11-01");
    expect(explain(1).at).toBe("2026-10-27T04:00:00.000Z");
  });

  it("rejects days outside the forecast", () => {
    expect(() => explain(-1)).toThrow(RangeError);
    expect(() => explain(WINDOW_DAYS)).toThrow(RangeError);
  });
});

describe("due this day versus contributing this day", () => {
  it("separates tasks due on Thursday from everything adding pressure on Thursday", () => {
    const thu = explain(3);
    expect(thu.date).toBe("2026-10-29");
    expect(thu.dueThisDay.map((d) => d.id)).toEqual(["lab"]);
    const ids = thu.contributors.map((c) => c.id);
    // Due this day, plus later, overdue, backlog, undated tasks and upcoming events.
    expect(ids).toEqual(expect.arrayContaining(["lab", "essay", "corrections", "notebook", "flashcards", "office", "midterm"]));
    expect(ids).not.toContain("pset4");
  });

  it("gives due tasks their points at the day's start, not today's", () => {
    const thu = explain(3);
    const today = explain(0);
    const labThu = thu.dueThisDay.find((d) => d.id === "lab")!;
    const labToday = today.contributors.find((c) => c.id === "lab")!;
    expect(labThu.status).toBe("counted");
    expect(labThu.points).toBeGreaterThan(labToday.points);
  });

  it("marks a done task due that day as not counted", () => {
    const wed = explain(2);
    const discussion = wed.dueThisDay.find((d) => d.id === "discussion")!;
    expect(discussion.status).toBe("done");
    expect(discussion.points).toBeUndefined();
    expect(wed.contributors.map((c) => c.id)).not.toContain("discussion");
  });

  it("lists open tasks due between now and the day's start as assumed done", () => {
    expect(explain(0).assumedDone).toEqual([]);
    expect(explain(1).assumedDone.map((a) => a.id)).toEqual(["reading"]);
    expect(explain(4).assumedDone.map((a) => a.id)).toEqual(["reading", "pset4", "lab"]);
  });

  it("keeps already-overdue work counted on every day", () => {
    for (let i = 0; i < WINDOW_DAYS; i++) {
      const ids = explain(i).contributors.map((c) => c.id);
      expect(ids).toContain("corrections");
      expect(ids).toContain("notebook");
    }
  });

  it("never lists focus or out-of-office blocks as contributors", () => {
    for (let i = 0; i < WINDOW_DAYS; i++) expect(explain(i).contributors.map((c) => c.id)).not.toContain("focus");
  });
});

describe("contributor factors reproduce the engine's points", () => {
  it("task factors multiply to its points", () => {
    for (let i = 0; i < WINDOW_DAYS; i++) {
      for (const c of explain(i).contributors.filter((c): c is TaskContributor => c.kind === "task")) {
        expect(c.sizePoints * c.urgency * c.scaleFactor).toBeCloseTo(c.points, 1);
      }
    }
  });

  it("event factors multiply to its points", () => {
    const group = explain(0).contributors.find((c) => c.id === "group") as EventContributor;
    expect(group.hours).toBe(1.5);
    expect(group.organizerFactor).toBe(ORGANIZER_FACTOR);
    for (let i = 0; i < WINDOW_DAYS; i++) {
      for (const c of explain(i).contributors.filter((c): c is EventContributor => c.kind === "event")) {
        expect(c.hours * c.weightFactor * c.attendeeFactor * c.organizerFactor * c.proximity * c.windowFactor).toBeCloseTo(c.points, 1);
      }
    }
  });

  it("labels each task's timing", () => {
    const timing = Object.fromEntries(explain(3).contributors.filter((c): c is TaskContributor => c.kind === "task").map((c) => [c.id, c.timing]));
    expect(timing).toEqual({
      lab: "due-this-day",
      essay: "due-later",
      corrections: "overdue",
      notebook: "older-overdue",
      flashcards: "no-due",
    });
  });
});

describe("calendar coverage", () => {
  it("is full on today when events were fetched seven days ahead", () => {
    expect(explain(0).coverage.kind).toBe("full");
  });

  it("is partial on later days, because each day looks seven days past its own start", () => {
    const c = explain(3).coverage;
    expect(c.kind).toBe("partial");
    if (c.kind === "partial") expect(c.missingDays).toBeCloseTo(3 - 9 / 24, 1);
  });

  it("is unknown without a fetch time, and the text claims nothing", () => {
    const e = explain(2, midterm.items, { timeZone: midterm.timeZone, eventsLoadedThrough: null });
    expect(e.coverage.kind).toBe("unknown");
    expect(coverageText(e.coverage, midterm.timeZone)).not.toMatch(/loaded (for|through)/);
  });

  it("drops events past a stale fetch from the stale scenario", () => {
    const stale = scenario("stale-sync");
    const fri = explainForecastDay(stale.items, new Date(stale.now), 4, { timeZone: stale.timeZone, eventsLoadedThrough: stale.eventsLoadedThrough });
    expect(fri.contributors.map((c) => c.id)).not.toContain("midterm");
    // Friday starts 04:00Z and the fetch ran to 13:00Z: 9 h of its seven event days are covered.
    expect(fri.coverage).toEqual(expect.objectContaining({ kind: "partial", missingDays: 6.6 }));
  });
});

describe("wording", () => {
  it("writes units without calling points hours", () => {
    const thu = explain(3);
    const lab = thu.contributors.find((c) => c.id === "lab") as TaskContributor;
    expect(taskFormula(lab)).toMatch(/^L task: 8 size pts × [\d.]+ deadline\/preparation × [\d.]+ scale$/);
    const midtermEvent = thu.contributors.find((c) => c.id === "midterm") as EventContributor;
    expect(eventFormula(midtermEvent)).toMatch(/^2 h × Heavy 1.6 × 40 people 1.3 × distance [\d.]+$/);
    for (const line of assumptionLines(thu, midterm.timeZone)) expect(line).not.toMatch(/\d+(\.\d+)? (pts|points) of (work|hours)/);
  });

  it("states the completion assumption with the day's own count", () => {
    const lines = assumptionLines(explain(4), midterm.timeZone);
    expect(lines).toContain("3 open tasks due before then are assumed finished on time and left out.");
    expect(assumptionLines(explain(0), midterm.timeZone)[0]).toBe("Today is scored as of now.");
  });

  it("gives Pip a short line tied to the numbers", () => {
    const thu = explain(3);
    const line = pipLine(thu);
    expect(line.startsWith(`Thursday starts at ${thu.score} from ${thu.raw.toFixed(1)} pts.`)).toBe(true);
    expect(line).toContain(`Largest share: ${thu.contributors[0]!.title}`);
    expect(line.split(". ").length).toBeLessThanOrEqual(3);
    expect(line).not.toMatch(/hour|last week|usually|trend/i);
  });

  it("says nothing is adding pressure on an empty day", () => {
    const e = explainForecastDay([], now, 0, { timeZone: "UTC" });
    expect(e.score).toBe(0);
    expect(pipLine(e)).toBe("Today reads 0 from 0.0 pts. Nothing is adding pressure.");
  });
});
