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
      onToggle={() => {}}
    />);
    expect(html).toContain("Why this day is Redline");
    expect(html).toContain("Monday project");
    expect(html).toContain("L task, due in 1.3 days");
    expect(html).toContain("Biology");
    expect(html).toContain("+6.4");
    expect(html).toContain("Nothing due.");
    expect(html).toContain("work already overdue stays counted");
    expect(html).toContain('aria-label="Complete: Monday project"');
  });

  it("supports completing due tasks and reopening completed tasks, without task controls on events", () => {
    const html = renderToStaticMarkup(<ForecastDayPanel
      day={{ date: "2026-11-01", score: 45, zone: "working" }} isToday={false}
      items={[
        { id: "open", kind: "task", source: "team", title: "Team assignment", due: "2026-11-01T17:00:00Z" },
        { id: "done", kind: "task", source: "ics", title: "Completed assignment", due: "2026-11-01T17:00:00Z", doneAt: "2026-10-31T17:00:00Z" },
        { id: "event", kind: "event", source: "google", title: "Lecture", start: "2026-11-01T17:00:00Z", end: "2026-11-01T18:00:00Z" },
      ]}
      contributions={[{ itemId: "event", title: "Lecture", points: 1, reason: "1h Lecture, Normal" }]}
      timeZone="UTC" sheet={false} onClose={() => {}} onToggle={() => {}}
    />);
    expect(html).toContain('aria-label="Complete: Team assignment"');
    expect(html).toContain('aria-label="Mark not done: Completed assignment"');
    expect(html).not.toContain('aria-label="Complete: Lecture"');
    expect(html).toContain('aria-live="polite"');
  });

  it("keeps source-completed and not-yet-saved tasks read-only", () => {
    const html = renderToStaticMarkup(<ForecastDayPanel
      day={{ date: "2026-11-01", score: 0, zone: "cool" }} isToday={false}
      items={[
        { id: "source", kind: "task", source: "github", title: "Closed issue", due: "2026-11-01T17:00:00Z", doneAt: "2026-10-31T17:00:00Z" },
        { id: "local", kind: "task", source: "manual", title: "New unsaved task", due: "2026-11-01T17:00:00Z" },
      ]}
      contributions={[]} taskMeta={{ source: { sourceId: "github", itemKey: "issue", completedInSource: true } }}
      pendingTaskIds={new Set(["local"])}
      timeZone="UTC" sheet={false} onClose={() => {}} onToggle={() => {}}
    />);
    const sourceButton = html.match(/<button\b[^>]*aria-label="Completed in source: Closed issue"[^>]*>/)?.[0];
    const pendingButton = html.match(/<button\b[^>]*aria-label="Complete: New unsaved task"[^>]*>/)?.[0];
    expect(sourceButton).toContain('disabled=""');
    expect(pendingButton).toContain('disabled=""');
    expect(html).toContain("Completed in source — reopen there");
  });
});
