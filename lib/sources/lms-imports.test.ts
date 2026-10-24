import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { classifyIcs } from "./ics";
import { applyItemState } from "./state";

const NOW = new Date("2026-10-23T12:00:00Z");
const SOURCE = "11111111-1111-4111-8111-111111111111";
const opts = { sourceId: SOURCE, coursework: true, now: NOW, timeZone: "America/New_York" };
const feed = (provider: string, version: number) => readFileSync(join(__dirname, "__fixtures__/lms", `${provider}-v${version}.ics`), "utf8");

describe.each(["brightspace", "canvas", "moodle", "blackboard"])("%s investigation feed", (provider) => {
  it("imports all three assignments as tasks, including essays without 'due' in their title", () => {
    const items = classifyIcs(feed(provider, 1), opts);
    expect(items).toHaveLength(3);
    expect(items.every((i) => i.kind === "task")).toBe(true);
    expect(items.find((i) => /Essay/.test(i.title))).toMatchObject({ size: "M", due: expect.stringMatching(/T17:00:00.000Z$/) });
  });

  it("reconciles renamed, moved, removed, new and unchanged assignments by UID", () => {
    const before = classifyIcs(feed(provider, 1), opts);
    const after = classifyIcs(feed(provider, 2), opts);
    expect(after).toHaveLength(3);
    expect(after.every((i) => i.kind === "task")).toBe(true);
    const renamed = after.find((i) => /UPDATED/.test(i.title))!;
    const original = before.find((i) => i.id === renamed.id)!;
    expect(original).toBeDefined();
    expect(renamed.due).not.toBe(original.due);
    expect(after.some((i) => i.title === original.title)).toBe(false);
    expect(after.some((i) => /Quiz/.test(i.title))).toBe(false);
    expect(after.some((i) => /Reading/.test(i.title))).toBe(true);
    const doneAt = "2026-10-23T11:00:00.000Z";
    const state = [{ source_id: SOURCE, item_key: original.itemKey, done_at: doneAt, size_override: "L" as const }];
    expect(applyItemState(after, state, NOW).find((i) => i.id === original.id)).toMatchObject({ title: renamed.title, doneAt, size: "L" });
  });
});

function calendar(...entries: string[]) {
  return ["BEGIN:VCALENDAR", "VERSION:2.0", ...entries, "END:VCALENDAR"].join("\r\n");
}
function event(fields: string[]) {
  return ["BEGIN:VEVENT", "UID:task@school.example", "DTSTAMP:20261022T120000Z", "DTSTART:20261024T160000Z", "DTEND:20261024T170000Z", ...fields, "END:VEVENT"].join("\r\n");
}

describe("coursework metadata", () => {
  it.each([
    ["https://school.example/courses/101/assignments/7", "Draft 2 [BIO 101]", "BIO 101"],
    ["https://school.example/d2l/lms/dropbox/user/folder_submit_files.d2l?ou=101&db=7", "Draft 2", "BIO 101"],
    ["https://school.example/mod/assign/view.php?id=7", "Draft 2", "BIO 101"],
  ])("uses assignment links as evidence even without title keywords (%s)", (url, title, courseName) => {
    const text = calendar(event([`SUMMARY:${title}`, `URL:${url}`, "LOCATION:BIO 101", "CATEGORIES:BIO 101"]));
    expect(classifyIcs(text, opts)[0]).toMatchObject({ kind: "task", title, courseName, course: courseName, url, due: "2026-10-24T17:00:00.000Z" });
  });

  it("reads an HTML assignment link from a description without rendering its HTML", () => {
    const url = "https://school.example/courses/101/assignments/7";
    const text = calendar(event(["SUMMARY:Draft 2 [BIO 101]", `DESCRIPTION:<p><a href="${url}">Open assignment</a></p>`]));
    expect(classifyIcs(text, opts)[0]).toMatchObject({ kind: "task", courseName: "BIO 101", url });
  });

  it("keeps lectures as events and does not call a room a course", () => {
    const text = calendar(event(["SUMMARY:Lecture", "LOCATION:Room 201"]));
    expect(classifyIcs(text, opts)[0]).toMatchObject({ kind: "event", title: "Lecture" });
    expect(classifyIcs(text, opts)[0]).not.toHaveProperty("courseName");
  });

  it("never exposes an executable URL or a calendar feed token as an assignment link", () => {
    for (const url of ["javascript:alert(1)", "https://school.example/calendar/export_execute.php?authtoken=secret", "https://user:secret@school.example/courses/1/assignments/2"]) {
      const item = classifyIcs(calendar(event(["SUMMARY:Essay", `URL:${url}`])), opts)[0];
      expect(item?.url).toBeUndefined();
    }
  });

  it("keeps the occurrence identity when a recurring deadline is moved", () => {
    const series = event(["SUMMARY:Essay", "RRULE:FREQ=DAILY;COUNT=3"]);
    const override = ["BEGIN:VEVENT", "UID:task@school.example", "RECURRENCE-ID:20261025T160000Z", "DTSTAMP:20261022T120000Z", "DTSTART:20261025T180000Z", "DTEND:20261025T190000Z", "SUMMARY:Essay moved", "END:VEVENT"].join("\r\n");
    const before = classifyIcs(calendar(series), opts);
    const after = classifyIcs(calendar(series, override), opts);
    expect(after.find((i) => i.title === "Essay moved")?.id).toBe(before.find((i) => i.due === "2026-10-25T17:00:00.000Z")?.id);
  });
});
