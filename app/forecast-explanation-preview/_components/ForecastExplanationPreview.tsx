"use client";

import { useMemo, useState } from "react";
import { computePressure } from "@/lib/pressure";
import { Card, Eyebrow } from "@/components/ui/Card";
import { ForecastStrip } from "@/components/boiler/ForecastStrip";
import { ForecastDayExplanation } from "@/components/analytics/forecast/ForecastDayExplanation";
import { explainForecastDay } from "@/lib/analytics/forecast/explain";
import { SCENARIOS } from "@/lib/analytics/forecast/fixtures";

function local(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

export function ForecastExplanationPreview() {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0]!.id);
  const [dayIndex, setDayIndex] = useState(3);
  const s = SCENARIOS.find((x) => x.id === scenarioId)!;
  const now = useMemo(() => new Date(s.now), [s.now]);
  const forecast = useMemo(() => computePressure(s.items, now, { timeZone: s.timeZone }).forecast, [s, now]);
  const explanation = useMemo(
    () => explainForecastDay(s.items, now, dayIndex, { timeZone: s.timeZone, eventsLoadedThrough: s.eventsLoadedThrough }),
    [s, now, dayIndex],
  );
  const strip = {
    items: s.items,
    timeZone: s.timeZone,
    openDate: forecast[dayIndex]!.date,
    onOpen: (date: string) => setDayIndex(forecast.findIndex((d) => d.date === date)),
  };

  return (
    <>
      <Card as="section" aria-labelledby="scenario-title" className="px-4 py-4 sm:px-6">
        <fieldset className="m-0 border-0 p-0">
          <legend id="scenario-title" className="mb-2 p-0">
            <Eyebrow>Synthetic scenario</Eyebrow>
          </legend>
          <div className="flex flex-col gap-2">
            {SCENARIOS.map((x) => (
              <label key={x.id} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-line px-3 py-2 has-checked:border-brass">
                <input
                  type="radio"
                  name="scenario"
                  value={x.id}
                  checked={x.id === scenarioId}
                  onChange={() => setScenarioId(x.id)}
                  className="mt-1 accent-(--brass-ink)"
                />
                <span>
                  <span className="block text-[15px] font-semibold text-fg">{x.label}</span>
                  <span className="block text-[13px] text-muted">{x.description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <dl className="mt-3 mb-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
          <dt className="text-muted">Clock</dt>
          <dd className="m-0 text-fg">
            {local(s.now, s.timeZone)} ({s.timeZone})
          </dd>
          <dt className="text-muted">Calendar loaded through</dt>
          <dd className="m-0 text-fg">{s.eventsLoadedThrough ? local(s.eventsLoadedThrough, s.timeZone) : "Not provided"}</dd>
        </dl>
        <details className="mt-3 text-[13px]">
          <summary className="min-h-11 cursor-pointer py-2 font-semibold text-fg">Synthetic inputs ({s.items.length} items)</summary>
          <ul className="m-0 list-none p-0">
            {s.items.map((i) => (
              <li key={i.id} className="border-t border-line py-1.5 text-body">
                <span className="font-semibold text-fg">{i.title}</span> ·{" "}
                {i.kind === "task"
                  ? `task, size ${i.size}, ${i.due ? `due ${local(i.due, s.timeZone)}` : "no due date"}${i.doneAt ? ", done" : ""}`
                  : `event, ${local(i.start!, s.timeZone)}${i.release ? ", focus block" : ""}${i.weight ? `, ${i.weight}` : ""}${i.attendees ? `, ${i.attendees} people` : ""}${i.isOrganizer ? ", organizer" : ""}`}
              </li>
            ))}
          </ul>
        </details>
      </Card>

      <Card as="section" aria-labelledby="preview-forecast" className="px-4 py-4 sm:px-7 sm:py-6">
        <h2 id="preview-forecast" className="m-0 mb-3 font-display text-[26px] leading-none font-normal tracking-[0.03em] sm:text-[30px]">
          7-day forecast
        </h2>
        <div className="sm:hidden">
          <ForecastStrip days={forecast} compact {...strip} />
        </div>
        <div className="hidden sm:block">
          <ForecastStrip days={forecast} {...strip} />
        </div>
        {/* Carries the strip's aria-controls target, as ForecastDayPanel does on My Boiler. */}
        <div id="forecast-day-panel" className="mt-4" aria-live="polite">
          <ForecastDayExplanation explanation={explanation} timeZone={s.timeZone} />
        </div>
      </Card>
    </>
  );
}
