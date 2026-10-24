import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { classifyIcs, cleanTitle, courseFromLocation, sizeForTitle, zonedTime } from "./ics";
import { SourceError } from "./types";

const FEED = readFileSync(join(__dirname, "__fixtures__", "brightspace.ics"), "utf8");
const NOW = new Date("2026-10-26T12:00:00Z"); // Monday, 08:00 in New York
const SOURCE = "11111111-1111-4111-8111-111111111111";

const classify = (coursework: boolean, text = FEED, label?: string) =>
  classifyIcs(text, { sourceId: SOURCE, coursework, now: NOW, timeZone: "UTC", label });
const byTitle = (items: ReturnType<typeof classify>) => new Map(items.map((i) => [i.title, i]));

describe("classifyIcs (Brightspace-style feed)", () => {
  it("turns deadlines into tasks with sizes and due times", () => {
    const items = byTitle(classify(true));
    expect(items.get("Lab Report 3")).toMatchObject({ kind: "task", source: "ics", size: "M", due: "2026-10-28T03:59:00.000Z" });
    expect(items.get("Quiz 4")).toMatchObject({ kind: "task", size: "M", due: "2026-10-29T15:00:00.000Z" });
    // All-day: due 23:59 that day in the feed's zone (X-WR-TIMEZONE America/New_York, EDT).
    expect(items.get("Midterm Exam")).toMatchObject({ kind: "task", size: "L", due: "2026-10-31T03:59:00.000Z" });
  });

  it("lists deadlines overdue up to 60 days (stale past 14) and drops those more than 7 days out", () => {
    const items = byTitle(classify(true));
    expect(items.get("Problem Set 5")).toMatchObject({ kind: "task", size: "S", due: "2026-10-16T03:59:00.000Z" });
    expect(items.get("Reading Response 1")).toMatchObject({ kind: "task", due: "2026-10-01T03:59:00.000Z" }); // 25 days back: listed, stale
    expect(items.has("Final Project Proposal")).toBe(false); // 8.6 days out
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
    expect(plain.get("Lab Report 3")?.kind).toBe("task");
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

describe("ICS task titles", () => {
  it("drop the Due decoration but keep their size and key", () => {
    const items = byTitle(classify(true));
    expect(items.get("Lab Report 3")).toMatchObject({ size: "M" });
    expect([...items.keys()].some((t) => /\bdue\b/i.test(t))).toBe(false);
    // The key hashes the UID, never the title, so done/size state survives the rename.
    const raw = classify(true, FEED.replace("SUMMARY:Lab Report 3 - Due", "SUMMARY:Lab Report 3"));
    expect(byTitle(raw).get("Lab Report 3")!.itemKey).toBe(items.get("Lab Report 3")!.itemKey);
  });
});

/** A feed of entries in the shape of the probed Brightspace feed (values redacted). */
const feedOf = (entries: { summary: string; location?: string; start: string; end?: string }[]) =>
  [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Desire2Learn Inc.//D2L Calendar//EN",
    ...entries.flatMap((e, i) => [
      "BEGIN:VEVENT",
      `UID:d2l-test-${i}@example.edu`,
      "DTSTAMP:20261024T120000Z",
      `DTSTART:${e.start}`,
      `DTEND:${e.end ?? e.start}`,
      `SUMMARY:${e.summary}`,
      ...(e.location ? [`LOCATION:${e.location}`] : []),
      "CLASS:PUBLIC",
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
  ].join("\r\n");

const AMS = "-AMS 210.02 Applied Linear Algebra - Fall 2026";

describe("ICS availability markers", () => {
  it("are skipped: neither tasks nor events", () => {
    const feed = feedOf([
      { summary: "Unit 4 Homework - Available", location: AMS, start: "20261027T130000Z" },
      { summary: "Unit 4 Quiz - Availability Starts", location: AMS, start: "20261027T140000Z" },
      { summary: "Unit 4 Quiz - Availability Ends", location: AMS, start: "20261028T140000Z", end: "20261028T150000Z" },
      { summary: "Unit 4 Homework - Due", location: AMS, start: "20261029T035900Z" },
    ]);
    expect(classify(true, feed).map((i) => `${i.kind} ${i.title}`)).toEqual(["task Unit 4 Homework"]);
  });

  it("only when the marker ends the title", () => {
    const feed = feedOf([{ summary: "Available seats lab - Due", start: "20261029T035900Z" }]);
    expect(classify(true, feed).map((i) => i.title)).toEqual(["Available seats lab"]);
  });
});

describe("ICS course", () => {
  it("comes from a Brightspace LOCATION, else the source label", () => {
    const feed = feedOf([
      { summary: "Unit 5 Quiz - Due", location: AMS, start: "20261029T035900Z" },
      { summary: "Essay 2 - Due", location: "Engineering 143 (-WRT 102.200 Intermediate Writing Workshop - Fall 2026)", start: "20261029T035900Z" },
      { summary: "Survey - Due", location: "Stony Brook University", start: "20261029T035900Z" },
      { summary: "Feedback - Due", location: "https://example.edu/survey (Stony Brook University)", start: "20261029T035900Z" },
      { summary: "Reading - Due", start: "20261029T035900Z" },
      { summary: "Review session", location: "-CSE 150.01,R01 Foundations of Computer Science: Honors - Fall 2026", start: "20261027T180000Z", end: "20261027T190000Z" },
    ]);
    const by = byTitle(classify(true, feed, "Brightspace"));
    expect(by.get("Unit 5 Quiz")?.course).toBe("AMS 210");
    expect(by.get("Essay 2")?.course).toBe("WRT 102");
    expect(by.get("Survey")?.course).toBe("Brightspace");
    expect(by.get("Feedback")?.course).toBe("Brightspace");
    expect(by.get("Reading")?.course).toBe("Brightspace");
    expect(by.get("Review session")).toMatchObject({ kind: "event", course: "CSE 150" });
  });

  it("is absent with no LOCATION course and no label", () => {
    const feed = feedOf([{ summary: "Reading - Due", location: "Hall 2", start: "20261029T035900Z" }]);
    expect(classify(true, feed)[0]).not.toHaveProperty("course");
  });
});

describe("courseFromLocation", () => {
  it("shortens a course code to subject and number, dropping section and term", () => {
    expect(courseFromLocation(AMS)).toBe("AMS 210");
    expect(courseFromLocation("-WRT 102.200 Intermediate Writing Workshop - Fall 2026")).toBe("WRT 102");
    expect(courseFromLocation("-CSE 150.01,R01 Foundations of Computer Science: Honors - Fall 2026")).toBe("CSE 150");
    expect(courseFromLocation("-HON 101.S08 Introduction to Honors College and Stony Brook - Fall 2026")).toBe("HON 101");
    expect(courseFromLocation("Engineering 143 (-AMS 210.02 Applied Linear Algebra - Fall 2026)")).toBe("AMS 210");
  });

  it("keeps the cleaned name when there is no code, capped at 60 characters", () => {
    expect(courseFromLocation("-Required Equity & Access Training - New Students (D, E, F, G)")).toBe(
      "Required Equity & Access Training - New Students (D, E, F, G",
    );
    expect(courseFromLocation("-Orientation Week - Spring 2027")).toBe("Orientation Week");
  });

  it("ignores locations without the Brightspace marker", () => {
    for (const loc of ["Stony Brook University", "https://example.edu/x (Stony Brook University)", "Hall 2", "Room 5 (East)", "", "-"]) {
      expect(courseFromLocation(loc), loc).toBeUndefined();
    }
  });
});

describe("cleanTitle", () => {
  it("strips Due suffixes in a few spellings", () => {
    for (const t of ["Lab Report 3 - Due", "Lab Report 3 – Due", "Lab Report 3 — due date", "Lab Report 3: Due", "Lab Report 3 (Due)", "Lab Report 3 -Due  "]) {
      expect(cleanTitle(t), t).toBe("Lab Report 3");
    }
  });

  it("strips Due prefixes", () => {
    expect(cleanTitle("Due: Essay 2")).toBe("Essay 2");
    expect(cleanTitle("DUE DATE - Essay 2")).toBe("Essay 2");
    expect(cleanTitle("Due Date: Essay 2 - Due")).toBe("Essay 2");
  });

  it("keeps Due inside a title, and a title that is only Due", () => {
    expect(cleanTitle("Assignment 2 due")).toBe("Assignment 2 due");
    expect(cleanTitle("Due process essay")).toBe("Due process essay");
    expect(cleanTitle("Overdue reading - notes")).toBe("Overdue reading - notes");
    expect(cleanTitle("Due")).toBe("Due");
    expect(cleanTitle(" - Due")).toBe("- Due");
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
