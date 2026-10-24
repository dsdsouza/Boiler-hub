import { describe, expect, it } from "vitest";
import demo from "./demo.json";
import type { Zone } from "@/lib/types";

const ZONES: Zone[] = ["cool", "working", "hot", "redline"];
const STATUSES = ["open", "heads_down", "running_hot", "away"];
const scoreOf = (raw: number) => Math.round(100 * (1 - Math.exp(-Math.max(raw, 0) / 25)));

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
