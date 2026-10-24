import { describe, expect, it } from "vitest";
import type { BoilerResponse } from "@/lib/pressure/api-types";
import { eventWeightBody, newTaskBody, statusBody, taskDoneBody, toMyBoilerData } from "./fromApi";

const SERIES = "a".repeat(64);

const res: BoilerResponse = {
  result: {
    score: 55,
    raw: 6.8,
    zone: "working",
    contributions: [
      { itemId: "evt1", title: "Standup", points: 0.5, reason: "15m Standup, Light" },
      { itemId: "t1", title: "Essay", points: 4, reason: "M task, due in 1 day" },
    ],
    counts: { meetings: 1, meetingHours: 0.3, tasksDue: 1, overdue: 0 },
    forecast: [],
  },
  tasks: [{ id: "t1", title: "Essay", dueAt: "2026-10-25T17:00:00Z", size: "M", doneAt: null, source: "manual", assignmentId: null }],
  events: [
    {
      id: "evt1",
      title: "Standup",
      start: "2026-10-25T09:00:00Z",
      end: "2026-10-25T09:15:00Z",
      weight: "light",
      override: null,
      seriesKey: SERIES,
      isRecurring: true,
      release: false,
    },
  ],
  status: { status: "heads_down", note: null },
  calendar: "reconnect",
  sources: [],
  computedAt: "2026-10-24T12:00:00Z",
};

describe("toMyBoilerData", () => {
  it("maps events and tasks to load items that match the contributions", () => {
    const d = toMyBoilerData(res);
    expect(d.items.map((i) => [i.id, i.kind])).toEqual([
      ["evt1", "event"],
      ["t1", "task"],
    ]);
    const ids = new Set(d.items.map((i) => i.id));
    for (const c of d.result.contributions) expect(ids.has(c.itemId)).toBe(true);
    expect(d.items[0]).toMatchObject({ weight: "light", seriesKey: SERIES, isRecurring: true, source: "google" });
    expect(d.items[1]).toMatchObject({ due: "2026-10-25T17:00:00Z", size: "M", doneAt: null });
  });

  it("carries status, sync time and calendar state", () => {
    const d = toMyBoilerData(res);
    expect(d.status).toBe("heads_down");
    expect(d.statusNote).toBe("");
    expect(d.syncedAt).toBe(res.computedAt);
    expect(d.calendar).toBe("reconnect");
  });

  it("maps course labels by id and skips items without one", () => {
    expect(toMyBoilerData(res).courses).toEqual({});
    const d = toMyBoilerData({
      ...res,
      tasks: [{ ...res.tasks[0]!, course: "BIO 101" }, { ...res.tasks[0]!, id: "t2", course: "  " }],
      events: [{ ...res.events[0]!, course: "CHEM 110" }],
    });
    expect(d.courses).toEqual({ t1: "BIO 101", evt1: "CHEM 110" });
  });

  it("keeps the calendar zone when the response has one, and leaves it absent otherwise", () => {
    expect(toMyBoilerData(res).timeZone).toBeUndefined();
    expect(toMyBoilerData({ ...res, timeZone: "America/New_York" } as BoilerResponse).timeZone).toBe("America/New_York");
  });
});

describe("request bodies match the engine routes", () => {
  it("POST /api/tasks { title, due_at?, size }", () => {
    expect(newTaskBody({ title: "Essay", due: "2026-10-25T17:00:00Z", size: "L" })).toEqual({
      title: "Essay",
      due_at: "2026-10-25T17:00:00Z",
      size: "L",
    });
    expect(newTaskBody({ title: "Essay", due: "", size: "S" })).toEqual({ title: "Essay", size: "S" });
  });

  it("PATCH /api/tasks/[id] { done }", () => {
    expect(taskDoneBody(true)).toEqual({ done: true });
  });

  it("PUT /api/event-weights { eventId, seriesKey?, weight|null, applyToSeries }", () => {
    expect(eventWeightBody({ id: "evt1", seriesKey: SERIES }, "heavy", true)).toEqual({
      eventId: "evt1",
      seriesKey: SERIES,
      weight: "heavy",
      applyToSeries: true,
    });
    expect(eventWeightBody({ id: "evt1", seriesKey: SERIES }, null, false)).toEqual({ eventId: "evt1", weight: null, applyToSeries: false });
    // No series key: falls back to a single-event tag.
    expect(eventWeightBody({ id: "evt2" }, "light", true)).toEqual({ eventId: "evt2", weight: "light", applyToSeries: false });
  });

  it("PATCH /api/me/status { status, note? }", () => {
    expect(statusBody("away", "Out Friday")).toEqual({ status: "away", note: "Out Friday" });
    expect(statusBody("open")).toEqual({ status: "open" });
  });
});
