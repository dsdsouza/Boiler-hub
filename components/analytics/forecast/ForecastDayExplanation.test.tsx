import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { explainForecastDay } from "@/lib/analytics/forecast/explain";
import { SCENARIOS } from "@/lib/analytics/forecast/fixtures";
import { ForecastDayExplanation } from "./ForecastDayExplanation";

// Vitest has no PostCSS for Tailwind; Pip's stylesheet is irrelevant to markup.
vi.mock("@/components/mascot/mascot.css", () => ({}));

const s = SCENARIOS[0]!;
const render = (dayIndex: number, eventsLoadedThrough = s.eventsLoadedThrough) =>
  renderToStaticMarkup(
    <ForecastDayExplanation
      explanation={explainForecastDay(s.items, new Date(s.now), dayIndex, { timeZone: s.timeZone, eventsLoadedThrough })}
      timeZone={s.timeZone}
    />,
  );

describe("ForecastDayExplanation", () => {
  it("labels the region by its heading and keeps due and contributing sections apart", () => {
    const html = render(3);
    const id = html.match(/aria-labelledby="([^"]+)"/)![1];
    expect(html).toContain(`id="${id}"`);
    expect(html).toMatch(/Why Thursday reads \d+/);
    expect(html).toContain("Due on Thursday");
    expect(html).toContain("Adding pressure at the start of Thursday");
    expect(html).toContain("Assumed finished before Thursday");
    expect(html).toContain("How this day is calculated");
  });

  it("names Pip's line for screen readers while the drawing stays decorative", () => {
    const html = render(3);
    expect(html).toContain('<span class="sr-only">Pip: </span>');
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/);
  });

  it("omits the assumed-finished section for today", () => {
    const html = render(0);
    expect(html).toContain("Why Today reads");
    expect(html).not.toContain("Assumed finished before");
    expect(html).toContain("Today is scored as of now.");
  });

  it("does not claim calendar coverage it was not given", () => {
    const html = render(3, null);
    expect(html).toContain("isn&#x27;t known here");
    expect(html).not.toContain("Calendar events are loaded");
  });

  it("writes points as relative effort, never as hours", () => {
    const html = render(3);
    expect(html).toContain("Points are relative effort, not hours.");
    expect(html).not.toMatch(/pts of work|hours of work|\d+(\.\d+)? hours? (of|left)/);
  });
});
