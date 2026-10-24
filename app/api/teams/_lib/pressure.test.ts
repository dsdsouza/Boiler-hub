import { describe, expect, it } from "vitest";
import { STUB_CONFIG, applyTaskToRaw, scoreFor, taskPoints, zoneFor } from "./pressure";

const now = new Date("2026-10-24T12:00:00Z");
const inDays = (d: number) => new Date(now.getTime() + d * 86_400_000).toISOString();

describe("pressure stand-in", () => {
  it("maps zone thresholds", () => {
    expect(zoneFor(0)).toBe("cool");
    expect(zoneFor(39)).toBe("cool");
    expect(zoneFor(40)).toBe("working");
    expect(zoneFor(69)).toBe("working");
    expect(zoneFor(70)).toBe("hot");
    expect(zoneFor(89)).toBe("hot");
    expect(zoneFor(90)).toBe("redline");
    expect(zoneFor(100)).toBe("redline");
  });

  it("scores 0 for non-positive raw and never exceeds 100", () => {
    expect(scoreFor(0)).toBe(0);
    expect(scoreFor(-10)).toBe(0);
    expect(scoreFor(1e6)).toBe(100);
  });

  it("uses urgency 1/days, capped, and the cap when overdue", () => {
    expect(taskPoints({ due: inDays(2), size: "M" }, now)).toBeCloseTo(4 / 2);
    expect(taskPoints({ due: inDays(0.1), size: "M" }, now)).toBe(4 * STUB_CONFIG.urgency.cap);
    expect(taskPoints({ due: inDays(-1), size: "L" }, now)).toBe(8 * STUB_CONFIG.urgency.cap);
  });

  it("treats a missing due date as due in 7 days", () => {
    expect(taskPoints({ size: "L" }, now)).toBeCloseTo(8 / 7);
    expect(taskPoints({ due: null, size: "L" }, now)).toBeCloseTo(taskPoints({ due: inDays(7), size: "L" }, now));
  });

  it("applyTaskToRaw returns score, zone and new raw", () => {
    const r = applyTaskToRaw(30, { due: inDays(1), size: "L" }, now);
    expect(r.raw).toBeCloseTo(38);
    expect(r.score).toBe(scoreFor(38));
    expect(r.zone).toBe(zoneFor(r.score));
  });
});
