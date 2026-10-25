import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ForecastDayPanel } from "./ForecastDayPanel";

describe("forecast day explanation", () => {
  it("shows causes that are due on a different day, their reasons and forecast points", () => {
    const html = renderToStaticMarkup(<ForecastDayPanel
      day={{ date: "2026-11-01", score: 95, zone: "redline" }}
      isToday={false}
      items={[{ id: "project", kind: "task", source: "manual", title: "Monday project", due: "2026-11-02T17:00:00Z", size: "L" }]}
      contributions={[{ itemId: "project", title: "Monday project", points: 6.4, reason: "L task, due in 1.3 days" }]}
      courses={{ project: "Biology" }}
      timeZone="America/New_York"
      sheet={false}
      onClose={() => {}}
    />);
    expect(html).toContain("Why this day is Redline");
    expect(html).toContain("Monday project");
    expect(html).toContain("L task, due in 1.3 days");
    expect(html).toContain("Biology");
    expect(html).toContain("+6.4");
    expect(html).toContain("Nothing due.");
    expect(html).toContain("work already overdue stays counted");
  });
});
