import { describe, expect, it } from "vitest";
import demo from "./demo.json";
import type { Zone } from "@/lib/types";
import { K } from "@/lib/pressure/config";

const ZONES: Zone[] = ["cool", "working", "hot", "redline"];
const STATUSES = ["open", "heads_down", "running_hot", "away"];
// Same curve as lib/pressure, written out so this test checks the fixture against K directly.
// Regenerate the fixture after retuning K: node scripts/gen-demo-fixture.mts
const scoreOf = (raw: number) => Math.round(100 * (1 - Math.exp(-Math.max(raw, 0) / K)));

describe("fixtures/demo.json", () => {
  it("has Product Squad (6) and AP Bio P3 (8)", () => {
    expect(demo.teams.map((t) => [t.team.name, t.team.type, t.boilers.length])).toEqual([
      ["Product Squad", "work", 6],
      ["AP Bio P3", "class", 8],
    ]);
  });

  it("boilers are valid BoilerCards with a raw that maps to their score", () => {
    for (const t of demo.teams) {
      expect(t.hiddenRaw).toHaveLength(t.hiddenCount);
      for (const b of t.boilers) {
        expect(ZONES).toContain(b.zone);
        expect(STATUSES).toContain(b.status);
        expect(scoreOf(b.raw)).toBe(b.score);
        expect(b.counts).toHaveProperty("meetingHours");
      }
    }
  });

  it("keeps the AP Bio demo story: 3 Hot, 1 Redline, 2 hidden", () => {
    const bio = demo.teams.find((t) => t.team.name === "AP Bio P3")!;
    const zones = bio.boilers.map((b) => b.zone);
    expect(zones.filter((z) => z === "hot")).toHaveLength(3);
    expect(zones.filter((z) => z === "redline")).toHaveLength(1);
    expect(bio.hiddenCount).toBe(2);
  });

  it("covers all four zones", () => {
    const zones = new Set(demo.teams.flatMap((t) => t.boilers.map((b) => b.zone)));
    expect([...zones].sort()).toEqual([...ZONES].sort());
  });

  it("Maya has a full PressureResult", () => {
    const { result } = demo.maya;
    expect(result.contributions).toHaveLength(12);
    expect(result.forecast).toHaveLength(7);
    const sum = result.contributions.reduce((s, x) => s + x.points, 0);
    expect(sum).toBeCloseTo(result.raw, 2);
    expect(scoreOf(result.raw)).toBe(result.score);
  });
});
