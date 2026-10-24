import { describe, expect, it } from "vitest";
import { computePressure } from "@/lib/pressure/compute";
import type { GoogleEvent } from "./calendar";
import { eventKey, normalizeEvents, sha256 } from "./normalize";

const NOW = new Date("2026-10-26T08:00:00Z");
let n = 0;
const ev = (extra: Partial<GoogleEvent> = {}): GoogleEvent => ({
  id: `ev${++n}`,
  summary: "Sync",
  start: { dateTime: "2026-10-26T10:00:00Z" },
  end: { dateTime: "2026-10-26T11:00:00Z" },
  ...extra,
});

describe("normalizeEvents", () => {
  it("ignores declined and transparent (Free) events", () => {
    const declined = ev({ attendees: [{ self: true, responseStatus: "declined" }, { responseStatus: "accepted" }] });
    const free = ev({ transparency: "transparent" });
    const kept = ev();
    const items = normalizeEvents([declined, free, kept]);
    expect(items.map((i) => i.id)).toEqual([kept.id]);
    expect(computePressure(normalizeEvents([declined, free]), NOW).score).toBe(0);
  });

  it("skips all-day, cancelled and workingLocation events", () => {
    const allDay = ev({ start: { date: "2026-10-27" }, end: { date: "2026-10-28" } });
    const cancelled = ev({ status: "cancelled" });
    const location = ev({ eventType: "workingLocation" });
    expect(normalizeEvents([allDay, cancelled, location])).toEqual([]);
  });

  it("turns focusTime and outOfOffice into releases", () => {
    const [focus, ooo] = normalizeEvents([ev({ eventType: "focusTime", summary: undefined }), ev({ eventType: "outOfOffice" })]);
    expect(focus).toMatchObject({ release: true, title: "Focus time" });
    expect(ooo.release).toBe(true);
  });

  it("counts non-declined attendees and reads organizer.self", () => {
    const [item] = normalizeEvents([
      ev({
        organizer: { self: true },
        attendees: [
          { self: true, responseStatus: "accepted" },
          { responseStatus: "needsAction" },
          { responseStatus: "declined" },
          { responseStatus: "tentative" },
        ],
      }),
    ]);
    expect(item).toMatchObject({ attendees: 3, isOrganizer: true, kind: "event", source: "google" });
  });

  it("hashes recurringEventId into seriesKey and marks recurring", () => {
    const [single, instance] = normalizeEvents([ev({ id: "solo" }), ev({ id: "abc_20261026T100000Z", recurringEventId: "abc" })]);
    expect(single).toMatchObject({ seriesKey: sha256("solo"), isRecurring: false });
    expect(instance).toMatchObject({ seriesKey: sha256("abc"), isRecurring: true });
    expect(instance.seriesKey).toMatch(/^[0-9a-f]{64}$/);
  });

  it("resolves weights: single-event override, then series override, then engine default", () => {
    const a = ev({ id: "s_1", recurringEventId: "s" });
    const b = ev({ id: "s_2", recurringEventId: "s" });
    const c = ev({ id: "s_3", recurringEventId: "s" });
    const weights = new Map([
      [sha256("s"), "heavy" as const],
      [eventKey("s_2"), "light" as const],
    ]);
    const [ia, ib] = normalizeEvents([a, b], weights);
    expect(ia.weight).toBe("heavy");
    expect(ib.weight).toBe("light");
    expect(normalizeEvents([c]).at(0)?.weight).toBeUndefined();
  });
});
