"use client";

import { useState } from "react";
import type { LoadItem } from "@/lib/types";
import type { SourceInfo } from "@/lib/pressure/api-types";
import { Card, CardTitle } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { CalendarFeedForm } from "@/components/sources/SourceForms";
import { scheduleDays } from "./schedule";

const NO_SOURCES: SourceInfo[] = [];

export function ClassSchedule({ items, sources = NO_SOURCES, demo = false, onImported }: {
  items: LoadItem[];
  sources?: SourceInfo[];
  demo?: boolean;
  onImported: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const now = new Date();
  const days = scheduleDays(items, sources, now);
  const active = days.find((day) => day.key === selected) ?? days[0]!;
  const feeds = sources.filter((s) => s.kind === "ics" && s.coursework);
  const hasFeed = feeds.length > 0;
  const failed = feeds.filter((s) => s.status !== "ok");
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <Card as="section" aria-labelledby="class-schedule-title" className="px-4 py-5 sm:px-7 sm:py-6">
      <div className="mb-4">
        <CardTitle id="class-schedule-title">Class schedule</CardTitle>
      </div>
      {!hasFeed && <p className="mt-0 mb-4 text-sm text-muted">
        Nothing here? <a href="/settings/sources#class-schedule" className="text-brass-ink underline underline-offset-2">Connect Brightspace or your school provider!</a>
      </p>}

      {hasFeed && <>
        {failed.length > 0 && <p role="status" className="mt-0 mb-4 text-sm text-redline-ink">
          Could not read {failed.map((s) => s.label).join(", ")}. This schedule may be incomplete. Refresh to try again, or check the connection in Connect.
        </p>}
        <div role="group" aria-label="Choose a schedule day" className="mb-4 grid grid-cols-7 gap-1 sm:gap-2">
          {days.map((day, i) => <button
            key={day.key}
            type="button"
            aria-pressed={day.key === active.key}
            aria-controls="class-schedule-events"
            aria-label={`${day.date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}, ${day.entries.length} ${day.entries.length === 1 ? "event" : "events"}`}
            onClick={() => setSelected(day.key)}
            className={`bp-control flex min-h-16 min-w-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border px-1 py-2 ${day.key === active.key ? "border-brass bg-surface-2 text-fg" : "border-line text-muted hover:border-rivet hover:text-fg"}`}
          >
            <span className="text-[11px] font-semibold sm:text-xs">{i === 0 ? "Today" : day.date.toLocaleDateString("en-US", { weekday: "short" })}</span>
            <span className="font-mono text-lg leading-none tabular-nums">{day.date.getDate()}</span>
            <span className="text-[10px] sm:text-[11px]">{day.entries.length} <span className="sr-only sm:not-sr-only">{day.entries.length === 1 ? "event" : "events"}</span></span>
          </button>)}
        </div>

        <div id="class-schedule-events" aria-live="polite" aria-atomic="true">
          <h3 className="mt-0 mb-2 text-sm font-semibold">{active.date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</h3>
          {active.entries.length === 0 ? <p className="m-0 border-t border-line py-4 text-sm text-muted">
            {failed.length === feeds.length ? "Your coursework calendars are unavailable. Check Connect to reconnect." : "No upcoming classes or timed events in your connected feeds for this day."}
          </p> : <ul className="m-0 list-none p-0">
            {active.entries.map(({ item, sourceLabel }) => <li key={item.id} className="flex flex-col gap-1 border-t border-line py-3 sm:flex-row sm:items-baseline sm:gap-4">
              <span className="shrink-0 font-mono text-xs text-brass-ink tabular-nums">
                <time dateTime={item.start}>{new Date(item.start!).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</time>
                {" – "}
                <time dateTime={item.end}>{new Date(item.end!).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</time>
              </span>
              <div className="min-w-0">
                <p className="m-0 text-sm font-semibold wrap-anywhere">{item.title}</p>
                <span className="text-xs text-muted">{sourceLabel}{item.isRecurring ? " · Repeats" : ""}</span>
              </div>
            </li>)}
          </ul>}
        </div>
        <p className="mt-2 mb-4 text-xs text-muted">Times shown in {timeZone}. Only events posted to the connected calendars appear here.</p>
      </>}

      {demo ? <LinkButton plain href="/auth/signin?next=/boiler" variant="ghost">Sign in to import your schedule</LinkButton> : <>
        <details className={hasFeed ? "border-t border-line pt-2" : ""}>
          <summary className="bp-summary flex min-h-11 cursor-pointer items-center text-sm font-semibold text-fg">Import from Brightspace</summary>
          <div className="pt-2">
            <CalendarFeedForm initialProvider="brightspace" showProvider={false} idPrefix="schedule-feed" onAdded={onImported} />
          </div>
        </details>
        {hasFeed && <a href="/settings/sources#class-schedule" className="mt-2 inline-flex min-h-11 items-center text-sm underline underline-offset-2">Manage schedule sources</a>}
      </>}
    </Card>
  );
}
