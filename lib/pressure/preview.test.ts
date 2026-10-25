import { describe, expect, it } from "vitest";
import { computePressure } from "./compute";
import { applyTaskToRaw } from "./preview";
import { NOW, managerWeek, studentWeek, task } from "./__fixtures__/weeks";

describe("applyTaskToRaw", () => {
  it("matches computePressure with the task added", () => {
    for (const week of [studentWeek(), managerWeek(), []]) {
      const before = computePressure(week, NOW);
      const t = task("Lab report", "L", 4);
      const after = computePressure([...week, t], NOW);
      const preview = applyTaskToRaw(before.raw, { due: t.due!, size: "L" }, NOW);
      expect(preview.raw).toBeCloseTo(after.raw, 10);
      expect(preview.score).toBe(after.score);
      expect(preview.zone).toBe(after.zone);
    }
  });

  it("raises the score and stays within 100", () => {
    const p = applyTaskToRaw(0, { due: new Date(NOW.getTime() - 1).toISOString(), size: "L" }, NOW);
    expect(p).toMatchObject({ score: 45, zone: "working" });
    expect(p.raw).toBeCloseTo(5.052590028);
    expect(applyTaskToRaw(1e6, { due: NOW.toISOString(), size: "S" }, NOW).score).toBe(100);
  });
});
