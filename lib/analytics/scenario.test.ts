import { describe, expect, it } from "vitest";
import { MAX_DEADLINE_SHIFT_DAYS, changeFromScenario, clampShift, shiftedDeadline } from "./scenario";
import { SYNTHETIC_NOW as NOW, SYNTHETIC_TIME_ZONE as TZ } from "./syntheticData";

const task = { id: "t", due: "2026-10-29T17:00:00-04:00" };

describe("scenario to change", () => {
  it("none and an unselected task produce no change", () => {
    expect(changeFromScenario(task, { kind: "none" }, NOW, TZ)).toBeNull();
    expect(changeFromScenario(undefined, { kind: "complete" }, NOW, TZ)).toBeNull();
  });

  it("builds one change per kind", () => {
    expect(changeFromScenario(task, { kind: "size", size: "L" }, NOW, TZ)).toEqual({ type: "size", taskId: "t", size: "L" });
    expect(changeFromScenario(task, { kind: "complete" }, NOW, TZ)).toEqual({ type: "complete", taskId: "t" });
    expect(changeFromScenario(task, { kind: "deadline", days: 2 }, NOW, TZ)).toEqual({ type: "deadline", taskId: "t", due: "2026-10-31T21:00:00.000Z" });
  });

  it("a zero shift is the baseline", () => {
    expect(changeFromScenario(task, { kind: "deadline", days: 0 }, NOW, TZ)).toBeNull();
  });

  it("clamps shifts to the control's range", () => {
    expect(clampShift(500)).toBe(MAX_DEADLINE_SHIFT_DAYS);
    expect(clampShift(-500)).toBe(-MAX_DEADLINE_SHIFT_DAYS);
    expect(clampShift(Number.NaN)).toBe(0);
    expect(clampShift(1.9)).toBe(1);
  });

  it("a task without a deadline shifts from the evaluation time", () => {
    expect(shiftedDeadline({ due: undefined }, 1, NOW, TZ)).toBe("2026-10-27T14:00:00.000Z");
  });
});
