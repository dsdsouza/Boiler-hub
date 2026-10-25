import { describe, expect, it } from "vitest";
import { calendarDay, groupDeadlines, monthDays, parseMonth, shiftMonth } from "./month";

describe("month deadline dates", () => {
  it("builds full weeks for leap years, short months and six-row months", () => {
    expect(monthDays("2024-02")).toHaveLength(35);
    expect(monthDays("2024-02")).toContain("2024-02-29");
    expect(monthDays("2026-02")).not.toContain("2026-02-29");
    expect(monthDays("2026-08")).toHaveLength(42);
    expect(monthDays("2026-10")[0]).toBe("2026-09-27");
  });
  it("crosses year boundaries without local-zone month drift", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(parseMonth("2026-13")).toBeNull();
    expect(parseMonth("2026-2")).toBeNull();
  });
  it("places near-midnight deadlines on the displayed civil day through DST", () => {
    expect(calendarDay("2026-11-01T03:59:00Z", "America/New_York")).toBe("2026-10-31");
    expect(calendarDay("2026-11-02T04:59:00Z", "America/New_York")).toBe("2026-11-01");
    const groups = groupDeadlines([
      { id: "later", title: "Later", dueAt: "2026-10-26T00:30:00Z", source: "manual" },
      { id: "earlier", title: "Earlier", dueAt: "2026-10-25T21:00:00Z", source: "team" },
    ], "America/New_York");
    expect(groups.get("2026-10-25")?.map((task) => task.id)).toEqual(["earlier", "later"]);
  });
});
