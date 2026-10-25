import { describe, expect, it } from "vitest";
import { computePressure } from "@/lib/pressure";
import type { LoadItem } from "@/lib/types";
import { SYNTHETIC_NOW as NOW, SYNTHETIC_TIME_ZONE as TZ, syntheticItems } from "./syntheticData";
import { simulateWhatIf, type WhatIfChange } from "./whatIf";
import { shiftIsoByLocalDays } from "./time";
import { pipWhatIfMessage } from "./pipExplanation";

const items = () => syntheticItems();
const run = (change: WhatIfChange | null, list: readonly LoadItem[] = items(), now = NOW) => simulateWhatIf({ items: list, now, timeZone: TZ, change });
const DAY = 24 * 36e5;

describe("baseline equality", () => {
  it("matches the engine exactly with the same inputs, time and zone", () => {
    const direct = computePressure(items() as LoadItem[], NOW, { timeZone: TZ });
    const r = run(null);
    expect(r.status).toBe("baseline");
    expect(r.baseline).toEqual(direct);
    expect(r.simulated).toEqual(direct);
    expect(r.delta).toEqual({ score: 0, raw: 0, zoneChanged: false, tasksDue: 0, overdue: 0 });
    expect(r.forecast.every((d) => d.delta === 0)).toBe(true);
    expect(r.forecast).toHaveLength(7);
  });

  it("a request equal to the current state leaves simulated equal to baseline", () => {
    const same = run({ type: "size", taskId: "syn-t-lab", size: "M" });
    expect(same.status).toBe("unchanged");
    expect(same.simulated).toEqual(same.baseline);
    const sameDue = run({ type: "deadline", taskId: "syn-t-lab", due: "2026-10-29T21:00:00Z" });
    expect(sameDue.status).toBe("unchanged");
  });

  it("every forecast day uses the engine's date labels for the zone, across the DST change", () => {
    const dates = run(null).forecast.map((d) => d.date);
    expect(dates).toEqual(["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"]);
  });
});

describe("size change", () => {
  it("raising size raises raw by the engine's points and compares to a direct run", () => {
    const r = run({ type: "size", taskId: "syn-t-lab", size: "L" });
    const manual = items().map((i) => (i.id === "syn-t-lab" ? { ...i, size: "L" as const } : i));
    expect(r.status).toBe("applied");
    expect(r.simulated).toEqual(computePressure(manual, NOW, { timeZone: TZ }));
    expect(r.delta.raw).toBeGreaterThan(0);
    expect(r.task?.after.points).toBeCloseTo((r.task?.before.points ?? 0) * 2, 1);
    expect(r.simulated.score).toBeGreaterThan(r.baseline.score);
  });

  it("lowering size lowers score and forecast days before the deadline", () => {
    const r = run({ type: "size", taskId: "syn-t-essay", size: "S" });
    expect(r.delta.score).toBeLessThan(0);
    expect(r.forecast[0].delta).toBeLessThan(0);
  });

  it("size on a task outside the 14-day window has no effect today", () => {
    const r = run({ type: "size", taskId: "syn-t-capstone", size: "S" });
    expect(r.status).toBe("applied");
    expect(r.task?.before.state).toBe("outside-window");
    expect(r.delta.raw).toBe(0);
    expect(r.simulated.score).toBe(r.baseline.score);
    expect(pipWhatIfMessage(r)).toContain("stays more than 14 days out");
  });
});

describe("deadline change", () => {
  it("moving later lowers urgency; moving earlier raises it", () => {
    const later = run({ type: "deadline", taskId: "syn-t-lab", due: shiftIsoByLocalDays("2026-10-29T17:00:00-04:00", 3, TZ) });
    const earlier = run({ type: "deadline", taskId: "syn-t-lab", due: shiftIsoByLocalDays("2026-10-29T17:00:00-04:00", -2, TZ) });
    expect(later.delta.raw).toBeLessThan(0);
    expect(earlier.delta.raw).toBeGreaterThan(0);
  });

  it("past deadline becomes overdue at the urgency cap and increments overdue", () => {
    const r = run({ type: "deadline", taskId: "syn-t-lab", due: new Date(NOW.getTime() - DAY).toISOString() });
    expect(r.task?.after.state).toBe("counted");
    expect(r.delta.overdue).toBe(1);
    expect(r.task?.after.points).toBeCloseTo(2.53, 2);
  });

  it("moving beyond the 14-day lookahead removes the task from today's score", () => {
    const edge = NOW.getTime() + 14 * DAY;
    const inside = run({ type: "deadline", taskId: "syn-t-lab", due: new Date(edge).toISOString() });
    const outside = run({ type: "deadline", taskId: "syn-t-lab", due: new Date(edge + 1).toISOString() });
    expect(inside.task?.after.state).toBe("outside-window");
    expect(outside.task?.after.state).toBe("outside-window");
    expect(outside.task?.after.points).toBe(0);
    expect(outside.simulated.counts.tasksDue).toBe(outside.baseline.counts.tasksDue - 1);
  });

  it("older than 14 days overdue uses the reduced backlog weight", () => {
    const edge = NOW.getTime() - 14 * DAY;
    const recent = run({ type: "deadline", taskId: "syn-t-lab", due: new Date(edge).toISOString() });
    const stale = run({ type: "deadline", taskId: "syn-t-lab", due: new Date(edge - 1).toISOString() });
    expect(recent.task?.after.points).toBeGreaterThan(0);
    expect(stale.task?.after.points).toBeCloseTo(recent.task?.after.points ?? 0, 2);
  });

  it("a deadline exactly now counts at the urgency cap and a deadline-less task can gain one", () => {
    const now = run({ type: "deadline", taskId: "syn-t-lab", due: NOW.toISOString() });
    expect(now.task?.after.points).toBeCloseTo(2.53, 2);
    const gained = run({ type: "deadline", taskId: "syn-t-reading", due: new Date(NOW.getTime() + DAY).toISOString() });
    expect(gained.task?.before.due).toBeNull();
    expect(gained.delta.raw).toBeGreaterThan(0);
  });

  it("forecast: a task moved past day 7 stays open through every forecast day", () => {
    const r = run({ type: "deadline", taskId: "syn-t-calc", due: "2026-11-05T12:00:00-05:00" });
    const base = run(null);
    expect(r.simulated.forecast[6].score).toBeGreaterThanOrEqual(base.simulated.forecast[6].score);
    expect(r.forecast[2].delta).toBeGreaterThan(0); // baseline assumed it finished on Tuesday
  });

  it("keeps wall-clock time across the DST change", () => {
    expect(shiftIsoByLocalDays("2026-10-31T23:00:00-04:00", 1, TZ)).toBe("2026-11-02T04:00:00.000Z");
    expect(shiftIsoByLocalDays("2026-11-01T23:00:00-05:00", -1, TZ)).toBe("2026-11-01T03:00:00.000Z");
  });
});

describe("completion and reset", () => {
  it("removes only that task's contribution, at any urgency", () => {
    const r = run({ type: "complete", taskId: "syn-t-essay" });
    const without = computePressure((items() as LoadItem[]).filter((i) => i.id !== "syn-t-essay"), NOW, { timeZone: TZ });
    expect(r.simulated.raw).toBeCloseTo(without.raw, 9);
    expect(r.task?.after).toMatchObject({ state: "complete", points: 0 });
    expect(r.simulated.contributions.find((c) => c.itemId === "syn-t-essay")).toBeUndefined();
    expect(r.simulated.counts.tasksDue).toBe(r.baseline.counts.tasksDue - 1);
    expect(r.simulated.forecast.every((d, i) => d.score <= r.baseline.forecast[i].score)).toBe(true);
  });

  it("completing an overdue task releases it and reduces overdue count", () => {
    const r = run({ type: "complete", taskId: "syn-t-quiz" });
    expect(r.delta.overdue).toBe(-1);
    expect(r.delta.score).toBeLessThanOrEqual(0);
  });

  it("completion never goes negative: a lone task completes to 0", () => {
    const lone: LoadItem[] = [{ id: "a", kind: "task", source: "manual", title: "A", size: "L", due: new Date(NOW.getTime() + DAY).toISOString() }];
    const r = run({ type: "complete", taskId: "a" }, lone);
    expect(r.simulated.raw).toBe(0);
    expect(r.simulated.score).toBe(0);
    expect(r.simulated.forecast.every((d) => d.score === 0)).toBe(true);
  });

  it("reset (null change) returns exactly the baseline again", () => {
    const list = items();
    const applied = run({ type: "complete", taskId: "syn-t-lab" }, list);
    const reset = run(null, list);
    expect(applied.simulated.score).not.toBe(reset.simulated.score);
    expect(reset.simulated).toEqual(applied.baseline);
    expect(reset.status).toBe("baseline");
  });

  it("applying one change never carries over to the next request", () => {
    const list = items();
    run({ type: "complete", taskId: "syn-t-lab" }, list);
    const next = run({ type: "size", taskId: "syn-t-essay", size: "S" }, list);
    expect(next.simulated.contributions.find((c) => c.itemId === "syn-t-lab")).toBeDefined();
  });
});

describe("invalid requests", () => {
  const cases: [string, WhatIfChange, string][] = [
    ["unknown task", { type: "complete", taskId: "nope" }, "unknown-task"],
    ["an event", { type: "complete", taskId: "syn-e-team-sync" }, "not-a-task"],
    ["an already-complete task", { type: "size", taskId: "syn-t-done", size: "L" }, "already-complete"],
    ["a bad deadline", { type: "deadline", taskId: "syn-t-lab", due: "next friday" }, "invalid-deadline"],
    ["a bad size", { type: "size", taskId: "syn-t-lab", size: "XL" as never }, "invalid-size"],
  ];
  it.each(cases)("rejects %s and leaves simulated equal to baseline", (_n, change, code) => {
    const r = run(change);
    expect(r.status).toBe("invalid");
    expect(r.invalid?.code).toBe(code);
    expect(r.simulated).toEqual(r.baseline);
    expect(pipWhatIfMessage(r)).toMatch(/^I can't model that\./);
  });

  it("rejects ambiguous ids", () => {
    const dup: LoadItem[] = [
      { id: "x", kind: "task", source: "manual", title: "1", size: "S" },
      { id: "x", kind: "task", source: "manual", title: "2", size: "S" },
    ];
    expect(run({ type: "complete", taskId: "x" }, dup).invalid?.code).toBe("ambiguous-task");
  });

  it("treats a completion time in the future as still open", () => {
    const list: LoadItem[] = [{ id: "f", kind: "task", source: "manual", title: "F", size: "M", due: new Date(NOW.getTime() + DAY).toISOString(), doneAt: new Date(NOW.getTime() + DAY).toISOString() }];
    expect(run({ type: "complete", taskId: "f" }, list).status).toBe("applied");
  });

  it("throws for an invalid evaluation time", () => {
    expect(() => run(null, items(), new Date("nope"))).toThrow(RangeError);
  });
});

describe("input immutability", () => {
  it("never mutates items, now or the change, even with frozen inputs", () => {
    const list = items();
    const snapshot = JSON.stringify(list);
    const nowMs = NOW.getTime();
    const change = Object.freeze({ type: "deadline", taskId: "syn-t-lab", due: "2026-11-30T12:00:00Z" } as const);
    expect(() => run(change, list)).not.toThrow();
    expect(() => run({ type: "complete", taskId: "syn-t-calc" }, list)).not.toThrow();
    expect(JSON.stringify(list)).toBe(snapshot);
    expect(NOW.getTime()).toBe(nowMs);
    expect(Object.isFrozen(list)).toBe(true);
  });

  it("only the selected task differs between baseline and simulated inputs", () => {
    const r = run({ type: "size", taskId: "syn-t-lab", size: "L" });
    const changedIds = r.simulated.contributions.filter((c) => {
      const b = r.baseline.contributions.find((x) => x.itemId === c.itemId);
      return !b || b.points !== c.points;
    }).map((c) => c.itemId);
    expect(changedIds).toEqual(["syn-t-lab"]);
  });
});

describe("coverage and assumptions", () => {
  it("flags forecast days that miss events beyond the 7-day event window", () => {
    const r = run(null);
    expect(r.forecast[0].eventCoverage).toBe("full");
    expect(r.forecast.slice(1).every((d) => d.eventCoverage === "partial")).toBe(true);
    expect(r.coverage.partialEventDays).toBe(6);
    expect(r.coverageNotes.join(" ")).toMatch(/missing events/);
    const wide = simulateWhatIf({ items: items(), now: NOW, timeZone: TZ, change: null, eventsCoveredThrough: new Date(NOW.getTime() + 14 * DAY) });
    expect(wide.coverage.partialEventDays).toBe(0);
  });

  it("counts open tasks the model cannot see fully", () => {
    const t = run(null).coverage.tasks;
    expect(t).toMatchObject({ openNoDueDate: 1, outsideWindowNow: 1, enterWindowDuringForecast: 1, overdue: 1, staleOverdue: 0 });
  });

  it("explains imported deadline changes as hypothetical", () => {
    const r = run({ type: "deadline", taskId: "syn-t-lab", due: "2026-11-02T12:00:00-05:00" });
    expect(r.task?.imported).toBe(true);
    expect(r.assumptions.join(" ")).toMatch(/does not edit the source/);
    expect(pipWhatIfMessage(r)).toMatch(/school's deadline stays/);
  });
});

describe("Pip message", () => {
  it("is deterministic and cites computed numbers", () => {
    const r = run({ type: "complete", taskId: "syn-t-lab" });
    const msg = pipWhatIfMessage(r);
    expect(msg).toBe(pipWhatIfMessage(run({ type: "complete", taskId: "syn-t-lab" })));
    expect(msg).toContain(`from ${r.baseline.score} to ${r.simulated.score}`);
    expect(msg).toContain("Marking “Sample chemistry lab report” done would lower");
  });

  it("describes baseline and unchanged states", () => {
    expect(pipWhatIfMessage(run(null))).toMatch(/baseline/);
    expect(pipWhatIfMessage(run({ type: "size", taskId: "syn-t-lab", size: "M" }))).toMatch(/nothing moves/);
  });
});
