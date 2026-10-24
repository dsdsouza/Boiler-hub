import { describe, expect, it } from "vitest";
import { ZONE_MIN } from "@/lib/pressure";
import { zoneOf } from "@/components/ui/zones";
import {
  BANNED_PHRASES,
  DEMO_TASKS,
  ZONE_LINE,
  ZONE_PRESET,
  completeTask,
  demoWeek,
  gentlestDue,
  insightFor,
  moveTask,
  notificationsFor,
  previewAssignment,
} from "./companion";

const NOW = new Date("2026-10-24T12:00:00Z");

describe("mascot preview companion", () => {
  it("places each preset inside its own zone", () => {
    for (const [zone, score] of Object.entries(ZONE_PRESET)) expect(zoneOf(score)).toBe(zone);
  });

  it("follows the engine's zone thresholds at the edges", () => {
    expect(zoneOf(ZONE_MIN.working - 1)).toBe("cool");
    expect(zoneOf(ZONE_MIN.working)).toBe("working");
    expect(zoneOf(ZONE_MIN.hot)).toBe("hot");
    expect(zoneOf(ZONE_MIN.redline)).toBe("redline");
  });

  it("finds Thursday as the busiest demo day", () => {
    const { peak, headline } = insightFor(demoWeek(62));
    expect(peak.long).toBe("Thursday");
    expect(headline).toBe("Thursday looks full.");
  });

  it("lowers pressure when a task is completed or moved later", () => {
    for (const t of DEMO_TASKS) expect(completeTask(74, t, NOW).after).toBeLessThan(74);
    expect(moveTask(92, DEMO_TASKS[2]!, 7, NOW).after).toBeLessThan(92);
  });

  it("previews assignments with the same direction as the engine", () => {
    const members = [{ name: "A", raw: 9 }, { name: "B", raw: 3 }];
    const p = previewAssignment(members, "L", 1, NOW);
    p.rows.forEach((r) => expect(r.after).toBeGreaterThanOrEqual(r.before));
    expect(gentlestDue(members, "L", NOW).p.crossings).toBeLessThanOrEqual(p.crossings);
  });

  it("keeps Pip's copy free of guilt and nagging", () => {
    const copy = [
      ...Object.values(ZONE_LINE).flatMap((l) => [l.headline, l.body]),
      ...[10, 55, 80, 95].flatMap((s) => notificationsFor(s).flatMap((n) => [n.title, n.body])),
    ]
      .join(" ")
      .toLowerCase();
    for (const phrase of BANNED_PHRASES) expect(copy).not.toContain(phrase);
  });
});
