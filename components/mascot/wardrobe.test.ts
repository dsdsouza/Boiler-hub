import { describe, expect, it } from "vitest";
import { ACCESSORIES, parseAccessory } from "./wardrobe";

describe("wardrobe", () => {
  it("has unique ids and starts with None", () => {
    const ids = ACCESSORIES.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe("none");
  });

  it("keeps a known accessory", () => {
    expect(parseAccessory("top-hat")).toBe("top-hat");
  });

  it("falls back to none for anything unknown", () => {
    expect(parseAccessory(null)).toBe("none");
    expect(parseAccessory("crown")).toBe("none");
    expect(parseAccessory("")).toBe("none");
  });
});
