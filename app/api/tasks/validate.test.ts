import { describe, expect, it } from "vitest";
import { parseCourse } from "./validate";

describe("parseCourse", () => {
  it("trims a label up to 60 characters", () => {
    expect(parseCourse("  BIO 101 ")).toBe("BIO 101");
    expect(parseCourse("x".repeat(60))).toBe("x".repeat(60));
  });

  it("treats null and blank as clearing it, and undefined as not given", () => {
    expect(parseCourse(null)).toBeNull();
    expect(parseCourse("   ")).toBeNull();
    expect(parseCourse(undefined)).toBeUndefined();
  });

  it("rejects long or non-string values", () => {
    expect(parseCourse("x".repeat(61))).toBe(false);
    expect(parseCourse(42)).toBe(false);
    expect(parseCourse(["BIO"])).toBe(false);
  });
});
