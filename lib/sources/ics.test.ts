import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { classifyIcs, sizeForTitle, zonedTime } from "./ics";
import { SourceError } from "./types";

const FEED = readFileSync(join(__dirname, "__fixtures__", "brightspace.ics"), "utf8");
const NOW = new Date("2026-10-26T12:00:00Z"); // Monday, 08:00 in New York
const SOURCE = "11111111-1111-4111-8111-111111111111";

const classify = (coursework: boolean, text = FEED) =>
  classifyIcs(text, { sourceId: SOURCE, coursework, now: NOW, timeZone: "UTC" });
const byTitle = (items: ReturnType<typeof classify>) => new Map(items.map((i) => [i.title, i]));

describe("classifyIcs (Brightspace-style feed)", () => {
  it("turns deadlines into tasks with sizes and due times", () => {
    const items = byTitle(classify(true));
    expect(items.get("Lab Report 3 - Due")).toMatchObject({ kind: "task", source: "ics", size: "M", due: "2026-10-28T03:59:00.000Z" });
    expect(items.get("Quiz 4 - Availability Ends")).toMatchObject({ kind: "task", size: "M", due: "2026-10-29T15:00:00.000Z" });
    // All-day: due 23:59 that day in the feed's zone (X-WR-TIMEZONE America/New_York, EDT).
    expect(items.get("Midterm Exam")).toMatchObject({ kind: "task", size: "L", due: "2026-10-31T03:59:00.000Z" });
  });

  it("keeps deadlines overdue up to 14 days and drops older or later than 7 days", () => {
    const items = byTitle(classify(true));
    expect(items.get("Problem Set 5 - Due")).toMatchObject({ kind: "task", size: "S", due: "2026-10-16T03:59:00.000Z" });
    expect(items.has("Reading Response 1 - Due")).toBe(false); // 25 days back
    expect(items.has("Final Project Proposal - Due")).toBe(false); // 8.6 days out
  });

  it("other timed entries become events; Free, cancelled and ended ones are skipped", () => {
    const events = classify(true).filter((i) => i.kind === "event");
    expect(events.map((e) => `${e.title} ${e.start}`).sort()).toEqual([
      "BIO 101 Lecture 2026-10-26T15:00:00.000Z",
      "BIO 101 Lecture 2026-10-30T15:00:00.000Z", // Oct 28 is an EXDATE
      "Collaboration session 2026-10-29T19:00:00.000Z", // "lab" only matches as a word
      "Office Hours 2026-10-27T18:00:00.000Z",
    ]);
    const lecture = events.find((e) => e.title === "BIO 101 Lecture")!;
    expect(lecture).toMatchObject({ source: "ics", isRecurring: true, end: "2026-10-26T16:15:00.000Z" });
  });

  it("all-day entries are deadlines only in coursework feeds, unless the title says so", () => {
    expect(byTitle(classify(true)).get("Fall Break")).toMatchObject({ kind: "task", size: "S" });
    const plain = byTitle(classify(false));
    expect(plain.has("Fall Break")).toBe(false);
    expect(plain.get("Midterm Exam")).toMatchObject({ kind: "task", size: "L" });
    expect(plain.get("Lab Report 3 - Due")?.kind).toBe("task");
  });

  it("gives every item a stable, distinct key and a source-scoped id", () => {
    const a = classify(true);
    const b = classify(true);
    expect(a.map((i) => i.itemKey)).toEqual(b.map((i) => i.itemKey));
    expect(new Set(a.map((i) => i.itemKey)).size).toBe(a.length);
    for (const i of a) {
      expect(i.itemKey).toMatch(/^[0-9a-f]{64}$/);
      expect(i.id).toBe(`${SOURCE}:${i.itemKey}`);
      expect(i.sourceId).toBe(SOURCE);
    }
    // Recurring instances share a series key, so "apply to series" tags every lecture.
    const lectures = a.filter((i) => i.title === "BIO 101 Lecture");
    expect(new Set(lectures.map((i) => i.seriesKey)).size).toBe(1);
  });

  it("falls back to the user's zone when the feed has none", () => {
    const noZone = FEED.replace("X-WR-TIMEZONE:America/New_York\n", "").replace("X-WR-TIMEZONE:America/New_York\r\n", "");
    const items = classifyIcs(noZone, { sourceId: SOURCE, coursework: true, now: NOW, timeZone: "America/Los_Angeles" });
    expect(byTitle(items).get("Midterm Exam")?.due).toBe("2026-10-31T06:59:00.000Z");
  });

  it("rejects something that is not a calendar", () => {
    expect(() => classify(true, "<html><body>Please sign in</body></html>")).toThrow(SourceError);
  });
});

describe("sizeForTitle", () => {
  const sizes = (titles: string[]) => titles.map(sizeForTitle);

  it("L for exams, midterms and finals", () => {
    expect(sizes(["Final Exam", "Midterm 2", "Finals week", "Exams"])).toEqual(["L", "L", "L", "L"]);
  });

  it("M for quizzes, projects, labs, papers, essays, reports and presentations", () => {
    expect(sizes(["Quiz 3", "Pop quizzes", "Group Project", "Lab 4", "Position paper", "Essay 2 due", "Lab Report 3", "Presentations"])).toEqual([
      "M", "M", "M", "M", "M", "M", "M", "M",
    ]);
  });

  it("L wins over M", () => {
    expect(sizes(["Final presentation", "Midterm project"])).toEqual(["L", "L"]);
  });

  it("S for homework, assignments, discussions, readings and anything else", () => {
    expect(sizes(["Homework 5", "Assignment 2 due", "Discussion post", "Reading Response 1", "Problem Set 5 - Due", "Fall Break"])).toEqual([
      "S", "S", "S", "S", "S", "S",
    ]);
  });

  it("matches whole words only", () => {
    expect(sizes(["Collaboration due", "Examples due", "Reportedly due"])).toEqual(["S", "S", "S"]);
  });
});

describe("zonedTime", () => {
  it("handles both sides of a DST change", () => {
    expect(new Date(zonedTime(2026, 10, 31, 23, 59, "America/New_York")).toISOString()).toBe("2026-11-01T03:59:00.000Z");
    expect(new Date(zonedTime(2026, 11, 1, 23, 59, "America/New_York")).toISOString()).toBe("2026-11-02T04:59:00.000Z");
  });
});
