import { describe, expect, it } from "vitest";
import type { ForecastDay } from "@/lib/types";
import { zoneOf } from "@/components/ui/zones";
import { dockMessage, type Snapshot } from "./dockMessage";
import { BANNED_PHRASES, FIRST_READING, ZONE_LINE } from "./voice";

// 2026-10-26 is a Monday. Local time, matching how the forecast's dates are read.
const NOW = new Date(2026, 9, 26, 9, 0).getTime();
const HOUR = 60 * 60 * 1000;

function week(scores: number[], start = 26): ForecastDay[] {
  return scores.map((s, i) => ({ date: `2026-10-${String(start + i).padStart(2, "0")}`, score: s, zone: zoneOf(s) }));
}

function snap(score: number, forecast: ForecastDay[] = week([score, 40, 40, 40, 40, 40, 40]), ageMs = HOUR): Snapshot {
  return {
    score,
    zone: zoneOf(score),
    counts: { meetings: 3, meetingHours: 4, tasksDue: 2, overdue: 0 },
    forecast,
    computedAt: new Date(NOW - ageMs).toISOString(),
  };
}

describe("dockMessage", () => {
  it("points a user with no reading to onboarding", () => {
    const m = dockMessage(null, NOW);
    expect(m.empty).toBe(true);
    expect(m.action.href).toBe("/onboarding");
    expect(m.attention).toBe(false);
  });

  it("won't comment on an old score, even a high one", () => {
    const m = dockMessage(snap(95, undefined, 3 * 24 * HOUR), NOW);
    expect(m.key).toBe("stale");
    expect(m.headline).toBe("My last reading was 3 days ago.");
    expect(m.attention).toBe(false);
    expect(dockMessage(snap(95, undefined, 30 * HOUR), NOW).headline).toBe("My last reading was yesterday.");
  });

  it("gets attentive when today is hot or redline", () => {
    for (const score of [78, 94]) {
      const m = dockMessage(snap(score), NOW);
      expect(m.reaction).toBe("attentive");
      expect(m.attention).toBe(true);
      expect(m.headline).toBe(ZONE_LINE[zoneOf(score)].headline);
    }
  });

  it("flags the heaviest day ahead by name", () => {
    const m = dockMessage(snap(50, week([50, 60, 72, 81, 64, 40, 30])), NOW);
    expect(m.headline).toBe("Thursday looks full.");
    expect(m.body).toContain("81 (Hot) on Thursday");
    expect(m.attention).toBe(true);
  });

  it("calls the next day tomorrow, counted from now rather than the snapshot", () => {
    // Snapshot taken late last night: its first day is yesterday.
    const m = dockMessage(snap(45, week([45, 50, 75, 40, 40, 40, 40], 25), 10 * HOUR), NOW);
    expect(m.headline).toBe("Tomorrow looks full.");
    expect(m.body).toContain("tomorrow");
  });

  it("ignores hot days that are already past", () => {
    const m = dockMessage(snap(45, week([80, 45, 50, 40, 40, 40, 40], 24)), NOW);
    expect(m.key).toBe("zone-working");
    expect(m.attention).toBe(false);
  });

  it("uses the zone line when nothing needs attention", () => {
    const m = dockMessage(snap(20, week([20, 22, 25, 30, 20, 15, 10])), NOW);
    expect(m.headline).toBe(ZONE_LINE.cool.headline);
    expect(m.action.href).toBe("/boiler");
  });

  it("never uses guilt or nagging language", () => {
    const lines = [
      ...[null, snap(95, undefined, 3 * 24 * HOUR), snap(78), snap(94), snap(50, week([50, 60, 72, 81, 64, 40, 30])), snap(20)].map((s) => {
        const m = dockMessage(s, NOW);
        return `${m.headline} ${m.body} ${m.action.label}`;
      }),
      ...Object.values(FIRST_READING),
    ];
    for (const line of lines) {
      for (const phrase of BANNED_PHRASES) expect(line.toLowerCase()).not.toContain(phrase);
    }
  });
});
