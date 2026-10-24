import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("./Mascot", () => ({ Mascot: () => null }));
import { mayaBoiler } from "@/components/boiler/fixture";
import { BoilerCompanion } from "./BoilerCompanion";

describe("Pip chat without calendar access", () => {
  it.each(["reconnect", "unavailable"] as const)("keeps assignment chat available when the calendar is %s", (calendar) => {
    const html = renderToStaticMarkup(createElement(BoilerCompanion, {
      data: { ...mayaBoiler(), calendar },
      vent: { key: 0, amount: 0 },
    }));
    expect(html).toContain("Ask Pip");
    expect(html).toContain("open assignments");
    expect(html).not.toContain("biggest driver");
    expect(html).not.toContain("forecast peaks");
  });

  it("does not expose chat in the public demo", () => {
    const html = renderToStaticMarkup(createElement(BoilerCompanion, {
      data: { ...mayaBoiler(), calendar: "reconnect" },
      vent: { key: 0, amount: 0 },
      chatEnabled: false,
    }));
    expect(html).toBe("");
  });
});
