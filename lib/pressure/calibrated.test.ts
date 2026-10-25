import { describe, expect, it } from "vitest";
import type { LoadItem, Size } from "@/lib/types";
import { computePressure, forecastBreakdown, isMajorExam, snapshotUsesCurrentModel } from "./compute";
import { applyTaskToRaw } from "./preview";
import { PRESSURE_MODEL_VERSION } from "./config";
import { computeTargets, toPreview } from "@/app/api/teams/_lib/assignment";
import { addTask, setTaskDone, type MyBoilerData } from "@/components/boiler/boilerState";

const now = new Date("2026-10-31T16:00:00Z");
const day = 86_400_000;
const task = (days: number, title = "Homework", size: Size = "L"): LoadItem => ({ id: "added", kind: "task", source: "manual", title, size, due: new Date(now.getTime() + days * day).toISOString() });

describe("calibrated shared model", () => {
  it("pins the selected task and exam weights", () => {
    expect(computePressure([task(7, "Midterm exam")], now).score).toBe(57);
    expect(computePressure([task(0.05, "Homework", "S")], now).score).toBe(14);
    expect(computePressure(Array.from({ length: 10 }, (_, i) => ({ ...task(5, "Assignment", "M"), id: String(i) })), now).score).toBe(51);
  });

  it("recognizes academic tests without turning sync tests and sample essays into exams", () => {
    for (const title of ["Physics Test 2", "Test 1", "Final Exam", "Midterm 2"]) expect(isMajorExam(title)).toBe(true);
    for (const title of ["Apple Calendar sync test", "Test notification", "Test Essay", "Final project", "Final presentation", "Flaky-test issue", "Quiz 2", "Reading"]) expect(isMajorExam(title)).toBe(false);
  });

  it("uses identical exam math for previews, posts, optimistic updates and completion", () => {
    const base: LoadItem[] = [{ ...task(3, "Essay", "M"), id: "base" }];
    const before = computePressure(base, now, { timeZone: "America/New_York" });
    const data: MyBoilerData = { result: before, items: base, status: "open", statusNote: "", syncedAt: now.toISOString(), calendar: "ok", timeZone: "America/New_York" };
    for (const title of ["Homework", "Physics Test 2", "Midterm exam"]) for (const days of [0, 1, 7, 13.9, 14, 15, 21, 27.9, 28, 35]) {
      const added = task(days, title);
      const input = { title, size: added.size!, due: added.due! };
      const actual = computePressure([...base, added], now, { timeZone: data.timeZone });
      const preview = applyTaskToRaw(before.raw, input, now);
      const posted = computeTargets([{ userId: "member", name: "Member", visible: true, raw: before.raw, score: before.score, zone: before.zone, updatedAt: now.toISOString(), modelCompatible: true }], input, now)[0];
      expect(preview.raw).toBeCloseTo(actual.raw, 12);
      expect(preview.score).toBe(actual.score);
      expect(posted.rawAfter).toBeCloseTo(actual.raw, 12);
      expect(posted.after).toBe(actual.score);
      const optimistic = addTask(data, input, "added", now);
      expect(optimistic.result).toEqual(actual);
      const completed = setTaskDone(optimistic, "added", true, now);
      expect(completed.data.result.score).toBe(before.score);
      expect(completed.vented).toBe(Math.round((actual.raw - before.raw) * 10) / 10);
    }
  });

  it("forecasts exams beyond two weeks and events beyond the current event window across DST", () => {
    const items: LoadItem[] = [task(20, "Physics exam"), { id: "future-event", kind: "event", source: "google", title: "Class", start: new Date(now.getTime() + 10 * day).toISOString(), end: new Date(now.getTime() + 10 * day + 3600000).toISOString() }];
    const result = computePressure(items, now, { timeZone: "America/New_York" });
    expect(result.counts.tasksDue).toBe(1);
    expect(result.counts.meetings).toBe(0);
    for (const entry of result.forecast) {
      const explanation = forecastBreakdown(items, now, entry.date, { timeZone: "America/New_York" })!;
      expect(explanation.score).toBe(entry.score);
      expect(explanation.contributions.some(c => c.itemId === "added")).toBe(true);
    }
    const later = forecastBreakdown(items, now, result.forecast[6].date, { timeZone: "America/New_York" })!;
    expect(later.counts.meetings).toBe(1);
    expect(later.score).toBeGreaterThan(result.score);
  });

  it("has no score cliffs at the deadline, horizon or overdue-aging boundary", () => {
    const minute = 1 / 1440;
    for (const title of ["Homework", "Midterm exam"]) for (const days of [0, -7, -14, 14, 28]) {
      const a = computePressure([task(days - minute, title)], now);
      const b = computePressure([task(days + minute, title)], now);
      expect(Math.abs(a.raw - b.raw)).toBeLessThan(0.01);
    }
    const overdue = computePressure([task(-60, "Unfinished assignment")], now);
    expect(overdue.raw).toBeGreaterThan(0);
    expect(overdue.counts.overdue).toBe(1);
  });

  it("excludes incompatible stored raw values from previews without fabricating a new score", () => {
    expect(snapshotUsesCurrentModel({ pressureModel: PRESSURE_MODEL_VERSION })).toBe(true);
    for (const counts of [null, {}, { pressureModel: "older" }]) expect(snapshotUsesCurrentModel(counts)).toBe(false);
    const old = { userId: "member", name: "Member", visible: true, raw: 40, score: 99, zone: "redline" as const, updatedAt: now.toISOString(), modelCompatible: false };
    const result = computeTargets([old], { title: "Exam", size: "L", due: task(7).due! }, now);
    expect(result[0]).toMatchObject({ after: 99, rawAfter: 40, recent: false });
    expect(toPreview([old], result)).toMatchObject({ members: [], noRecentData: [{ userId: "member", name: "Member" }] });
  });
});
