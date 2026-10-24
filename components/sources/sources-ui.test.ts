import { describe, expect, it } from "vitest";
import type { BoilerResponse } from "@/lib/pressure/api-types";
import * as S from "@/components/boiler/boilerState";
import { clearItemsBody, sourceItemBody, toMyBoilerData } from "@/components/boiler/fromApi";
import { defaultFeedLabel, isCourseworkUrl, sourceBadge } from "@/lib/sources/hints";

const NOW = new Date("2026-10-26T12:00:00Z");
const SRC = "11111111-1111-4111-8111-111111111111";
const KEY = "a".repeat(64);
const LATE = "b".repeat(64);

const res: BoilerResponse = {
  result: {
    score: 70,
    raw: 10,
    zone: "hot",
    contributions: [
      { itemId: `${SRC}:${KEY}`, title: "Lab Report 3 - Due", points: 4, reason: "M task, due in 1 day" },
      { itemId: `${SRC}:${LATE}`, title: "Problem Set 5 - Due", points: 12, reason: "M task, overdue" },
    ],
    counts: { meetings: 0, meetingHours: 0, tasksDue: 1, overdue: 1 },
    forecast: [],
  },
  tasks: [
    { id: `${SRC}:${KEY}`, title: "Lab Report 3 - Due", dueAt: "2026-10-27T12:00:00Z", size: "M", doneAt: null, source: "ics", assignmentId: null, sourceId: SRC, itemKey: KEY, sourceLabel: "Brightspace" },
    { id: `${SRC}:${LATE}`, title: "Problem Set 5 - Due", dueAt: "2026-10-16T03:59:00Z", size: "M", doneAt: null, source: "ics", assignmentId: null, sourceId: SRC, itemKey: LATE, sourceLabel: "Brightspace" },
    { id: "t1", title: "Essay", dueAt: "2026-10-28T12:00:00Z", size: "S", doneAt: null, source: "manual", assignmentId: null },
  ],
  events: [],
  status: { status: "open", note: null },
  calendar: "ok",
  sources: [{ id: SRC, kind: "ics", label: "Brightspace", coursework: true, status: "ok", error: null, lastSyncedAt: "2026-10-26T11:00:00Z" }],
  computedAt: NOW.toISOString(),
};

describe("source items in the My Boiler view model", () => {
  it("keeps source metadata for source tasks only", () => {
    const d = toMyBoilerData(res);
    expect(d.taskMeta).toEqual({
      [`${SRC}:${KEY}`]: { sourceId: SRC, itemKey: KEY, label: "Brightspace" },
      [`${SRC}:${LATE}`]: { sourceId: SRC, itemKey: LATE, label: "Brightspace" },
    });
    expect(d.sources).toHaveLength(1);
    expect(sourceItemBody(d.taskMeta![`${SRC}:${KEY}`]!, { done: true })).toEqual({ sourceId: SRC, itemKey: KEY, done: true });
  });

  it("finds and clears overdue source tasks without a vent", () => {
    const d = toMyBoilerData(res);
    const overdue = S.overdueSourceTasks(d, NOW);
    expect(overdue.map((i) => i.title)).toEqual(["Problem Set 5 - Due"]);
    const cleared = S.clearTasks(d, new Set(overdue.map((i) => i.id)));
    expect(cleared.items.some((i) => i.title === "Problem Set 5 - Due")).toBe(false);
    expect(cleared.result.raw).toBe(4);
    expect(clearItemsBody([d.taskMeta![overdue[0]!.id]!])).toEqual({ items: [{ sourceId: SRC, itemKey: LATE }], clear: true });
  });

  it("resizing an open task moves the needle with the engine's formula", () => {
    const d = toMyBoilerData(res);
    const bigger = S.setTaskSize(d, `${SRC}:${KEY}`, "L", NOW);
    expect(bigger.items.find((i) => i.id === `${SRC}:${KEY}`)?.size).toBe("L");
    expect(bigger.result.raw).toBeGreaterThan(d.result.raw);
  });
});

describe("hints", () => {
  it("recognizes coursework feeds and names them", () => {
    expect(isCourseworkUrl("webcal://school.brightspace.com/feed.ics")).toBe(true);
    expect(isCourseworkUrl("https://canvas.school.edu/feeds/calendars/user_x.ics")).toBe(true);
    expect(isCourseworkUrl("https://school.instructure.com/feeds/x.ics")).toBe(true);
    expect(isCourseworkUrl("https://outlook.office365.com/owa/calendar/x/calendar.ics")).toBe(false);
    expect(defaultFeedLabel("https://school.brightspace.com/x.ics")).toBe("Brightspace");
    expect(defaultFeedLabel("https://outlook.office365.com/x.ics")).toBe("Outlook");
    expect([sourceBadge("manual"), sourceBadge("team"), sourceBadge("github"), sourceBadge("ics", "Canvas"), sourceBadge("ics")]).toEqual([
      "Manual", "Team", "GitHub", "Canvas", "ICS",
    ]);
  });
});
