import { describe, expect, it } from "vitest";
import { ZONES } from "@/components/ui/zones";
import { heroExpression } from "./heroExpression";

describe("heroExpression", () => {
  it("follows the zone on your own boiler", () => {
    expect(heroExpression("cool").arm).toBe("wave");
    expect(heroExpression("working").mouth).toBe("smile");
    expect(heroExpression("hot")).toMatchObject({ brows: "worried", sweat: true });
    expect(heroExpression("redline")).toMatchObject({ brows: "raised", mouth: "o", arm: "raised" });
  });

  it("stays calm in every zone when showing someone else's Pip", () => {
    for (const z of ZONES) {
      expect(heroExpression(z, { face: "calm" })).toEqual({ eye: "open", brows: "none", mouth: "smile", arm: "down", sweat: false });
    }
  });

  it("celebrates a vent ahead of the zone, without worry", () => {
    const e = heroExpression("redline", { celebrating: true });
    expect(e).toMatchObject({ eye: "happy", mouth: "open", brows: "none", sweat: false });
  });
});
