import { describe, expect, it } from "vitest";
import type { LoadItem } from "@/lib/types";
import { bucketDay, coursesIn, dayLabel, dayKey, filterByCourse, filterByTab, openDueCount, sortTasks, tabCounts } from "./taskView";

const task = (id: string, due: string | undefined, doneAt: string | null = null): LoadItem => ({
  id,
  kind: "task",
  source: "manual",
  title: id,
  due,
  size: "M",
  doneAt,
});
const event = (id: string, start: string): LoadItem => ({
  id,
  kind: "event",
  source: "google",
  title: id,
  start,
  end: new Date(Date.parse(start) + 3_600_000).toISOString(),
});

const items: LoadItem[] = [
  task("essay", "2026-10-27T21:00:00Z"),
  task("lab", "2026-10-26T16:00:00Z", "2026-10-24T12:00:00Z"),
  event("lecture", "2026-10-26T14:00:00Z"),
  task("quiz", "2026-10-25T16:00:00Z"),
  task("reading", "2026-10-24T16:00:00Z", "2026-10-24T10:00:00Z"),
  task("notes", undefined),
];
const courses = { essay: "ENG 102", lab: "BIO 101", quiz: "BIO 101", lecture: "BIO 101", reading: "ENG 102" };

describe("task tabs", () => {
  const tasks = sortTasks(items);

  it("keep tasks only, open first, then by due date", () => {
    expect(tasks.map((t) => t.id)).toEqual(["notes", "quiz", "essay", "reading", "lab"]);
  });

  it("Open, Done and All split the list and keep its order", () => {
    expect(filterByTab(tasks, "open").map((t) => t.id)).toEqual(["notes", "quiz", "essay"]);
    expect(filterByTab(tasks, "done").map((t) => t.id)).toEqual(["reading", "lab"]);
    expect(filterByTab(tasks, "all")).toEqual(tasks);
  });

  it("count each tab", () => {
    expect(tabCounts(tasks)).toEqual({ open: 3, done: 2, all: 5 });
    expect(tabCounts([])).toEqual({ open: 0, done: 0, all: 0 });
  });
});

describe("class filter", () => {
  const tasks = sortTasks(items);

  it("lists distinct labels, sorted, ignoring items without one", () => {
    expect(coursesIn(tasks, courses)).toEqual(["BIO 101", "ENG 102"]);
    expect(coursesIn(tasks, {})).toEqual([]);
    expect(coursesIn([task("a", undefined)], { a: "BIO 101" })).toHaveLength(1);
  });

  it("null keeps everything, including unlabeled tasks", () => {
    expect(filterByCourse(tasks, courses, null)).toEqual(tasks);
  });

  it("a class drops unlabeled tasks and other classes", () => {
    expect(filterByCourse(tasks, courses, "BIO 101").map((t) => t.id)).toEqual(["quiz", "lab"]);
  });

  it("combines with each tab, and the counts follow the filter", () => {
    const bio = filterByCourse(tasks, courses, "BIO 101");
    expect(filterByTab(bio, "open").map((t) => t.id)).toEqual(["quiz"]);
    expect(filterByTab(bio, "done").map((t) => t.id)).toEqual(["lab"]);
    expect(tabCounts(bio)).toEqual({ open: 1, done: 1, all: 2 });
    const eng = filterByCourse(tasks, courses, "ENG 102");
    expect(tabCounts(eng)).toEqual({ open: 1, done: 1, all: 2 });
  });

  it("a class with no tasks left shows nothing", () => {
    expect(filterByCourse(tasks, courses, "CHEM 110")).toEqual([]);
  });
});

describe("day bucketing", () => {
  const NY = "America/New_York";
  // 11:59 PM Tuesday Oct 27 in New York (EDT, UTC−4) is 03:59 Wednesday in UTC.
  const lateNY = "2026-10-28T03:59:00Z";

  it("puts an 11:59 PM New York deadline on its New York day, not the UTC one", () => {
    expect(dayKey(lateNY, NY)).toBe("2026-10-27");
    expect(dayKey(lateNY, "UTC")).toBe("2026-10-28");
    const list = [task("midnight-ish", lateNY)];
    expect(bucketDay(list, "2026-10-27", NY).tasks.map((t) => t.id)).toEqual(["midnight-ish"]);
    expect(bucketDay(list, "2026-10-28", NY).tasks).toEqual([]);
    expect(bucketDay(list, "2026-10-28", "UTC").tasks.map((t) => t.id)).toEqual(["midnight-ish"]);
  });

  it("splits days by the local clock across the DST change (Nov 1, 2026)", () => {
    expect(dayKey("2026-11-01T03:30:00Z", NY)).toBe("2026-10-31"); // 11:30 PM EDT
    expect(dayKey("2026-11-01T04:30:00Z", NY)).toBe("2026-11-01"); // 12:30 AM EDT
    expect(dayKey("2026-11-02T04:30:00Z", NY)).toBe("2026-11-01"); // 11:30 PM EST
    expect(dayKey("2026-11-02T05:30:00Z", NY)).toBe("2026-11-02"); // 12:30 AM EST
  });

  it("lists that day's tasks (open and done) and events by time", () => {
    const list = [
      task("late", "2026-10-26T23:00:00Z"),
      task("done-early", "2026-10-26T13:00:00Z", "2026-10-25T20:00:00Z"),
      event("standup", "2026-10-26T13:30:00Z"),
      event("next-day", "2026-10-27T13:30:00Z"),
      task("undated", undefined),
    ];
    const day = bucketDay(list, "2026-10-26", NY);
    expect(day.tasks.map((t) => t.id)).toEqual(["done-early", "late"]);
    expect(day.events.map((e) => e.id)).toEqual(["standup"]);
    expect(openDueCount(list, "2026-10-26", NY)).toBe(1);
  });
});

describe("forecast day label", () => {
  it("names the day, zone, score and open items due", () => {
    expect(dayLabel({ date: "2026-10-29", score: 52, zone: "working" }, false, 3)).toBe("Thursday, Working, score 52, 3 items due");
    expect(dayLabel({ date: "2026-10-24", score: 18, zone: "cool" }, true, 1)).toBe("Today, Cool, score 18, 1 item due");
    expect(dayLabel({ date: "2026-10-30", score: 81, zone: "redline" }, false, 0)).toBe("Friday, Redline, score 81, nothing due");
  });
});
