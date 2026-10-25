import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SYNTHETIC_NOW, SYNTHETIC_TIME_ZONE, syntheticItems } from "@/lib/analytics";
import { WhatIfSimulator } from "./WhatIfSimulator";

// Vitest cannot load Pip's stylesheet; the real component is covered by the Playwright spec.
vi.mock("@/components/mascot/PipHero", () => ({
  PipHero: ({ score, zone }: { score: number; zone?: string }) => <div data-pip-score={score} data-pip-zone={zone} />,
}));

describe("WhatIfSimulator initial render", () => {
  const html = renderToStaticMarkup(<WhatIfSimulator items={syntheticItems()} now={SYNTHETIC_NOW} timeZone={SYNTHETIC_TIME_ZONE} />);

  it("starts at baseline with no change selected and no apply or save path", () => {
    expect(html).toContain("No hypothetical change yet");
    expect(html).toContain("This is your baseline");
    expect(html).not.toMatch(/>\s*(Apply|Save)\s*</);
    expect(html).not.toContain("<form action");
  });

  it("hands Pip the simulated score and zone through his existing props", () => {
    expect(html).toMatch(/data-pip-score="78" data-pip-zone="hot"/);
  });

  it("lists only open sample tasks and shows forecast, assumptions and coverage", () => {
    expect(html).toContain("Sample chemistry lab report");
    expect(html).not.toContain("already done");
    expect(html).toContain("Seven-day forecast");
    expect(html).toContain("Forecast assumptions");
    expect(html).toContain("Missing coverage");
  });
});
