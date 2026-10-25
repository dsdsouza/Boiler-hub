import { useId, type ReactNode } from "react";
import { WINDOW_DAYS } from "@/lib/pressure/config";
import { Mascot } from "@/components/mascot/Mascot";
import { ZONE_INK, ZONE_LABEL } from "@/components/ui/zones";
import type { Contributor, DueTask, ForecastDayExplanation as Explanation, TaskTiming } from "@/lib/analytics/forecast/explain";
import { assumptionLines, contributorFormula, dayName, eventTiming, formatPts, pipLine, taskTiming } from "@/lib/analytics/forecast/wording";

const TIMING_TAG: Record<TaskTiming, string> = {
  "due-this-day": "Due this day",
  "due-later": "Due later",
  overdue: "Overdue",
  "older-overdue": "Backlog",
  "no-due": "No due date",
};

const DUE_STATUS: Record<DueTask["status"], string> = {
  counted: "Open · counted",
  done: "Done · not counted",
  "not-counted": "Open · not counted",
};

function Points({ value }: { value?: number }) {
  return (
    <span className={`min-w-16 flex-none text-right font-mono text-sm font-bold ${value === undefined ? "text-muted" : "text-brass-ink"}`}>
      {value === undefined ? <span aria-label="no points">—</span> : `+${formatPts(value)}`}
    </span>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-4">
      <h4 className="mt-0 mb-1 text-[13px] font-semibold tracking-[0.1em] text-muted uppercase">{title}</h4>
      {children}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="m-0 border-t border-line py-2.5 text-sm text-muted">{children}</p>;
}

/**
 * Why a forecast day has its score: tasks due that day kept apart from everything adding pressure at
 * the day's start, each contributor's factors and units, tasks assumed finished first, and calendar
 * coverage. Presentational; build `explanation` with explainForecastDay.
 */
export function ForecastDayExplanation({ explanation: e, timeZone }: { explanation: Explanation; timeZone: string }) {
  const headingId = useId();
  const day = dayName(e);
  const when = e.isToday ? "now" : `at the start of ${day}`;
  const time = new Intl.DateTimeFormat(undefined, { timeZone, weekday: "short", hour: "numeric", minute: "2-digit" });

  const row = (c: Contributor) => (
    <li key={c.id} className="flex items-start gap-3 border-t border-line py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="break-words text-[15px] font-semibold text-fg">{c.title}</span>
          <span className="rounded border border-line px-1.5 text-[11px] font-semibold tracking-[0.04em] text-muted uppercase">
            {c.kind === "event" ? "Event" : TIMING_TAG[c.timing]}
          </span>
        </div>
        <div className="text-[13px] text-muted">{c.kind === "event" ? eventTiming(c) : taskTiming(c)}</div>
        <div className="font-mono text-[12px] break-words text-body">{contributorFormula(c)}</div>
      </div>
      <Points value={c.points} />
    </li>
  );

  return (
    <section aria-labelledby={headingId} data-forecast-explanation={e.date} className="rounded-lg border border-line bg-surface-2 px-4 py-4 sm:px-5">
      <h3 id={headingId} className="m-0 font-display text-[24px] leading-none font-normal tracking-[0.03em]">
        Why {day} reads {e.score}
      </h3>
      <p className="mt-1.5 mb-0 text-sm text-body">
        {e.contributors.length} {e.contributors.length === 1 ? "item adds" : "items add"} {formatPts(e.raw)} {when}. That total gives a score of{" "}
        <span className={`font-mono font-bold ${ZONE_INK[e.zone]}`}>{e.score}</span> · {ZONE_LABEL[e.zone]}.
      </p>

      <div className="mt-3 flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2">
        <Mascot score={e.score} size={44} />
        <p className="m-0 text-sm text-fg">
          <span className="sr-only">Pip: </span>
          {pipLine(e)}
        </p>
      </div>

      <Section title={`Due ${e.isToday ? "today" : `on ${day}`}`}>
        {e.dueThisDay.length === 0 ? (
          <Empty>Nothing due this day.</Empty>
        ) : (
          <ul className="m-0 list-none p-0">
            {e.dueThisDay.map((t) => (
              <li key={t.id} className="flex items-center gap-3 border-t border-line py-2.5">
                <div className="min-w-0 flex-1">
                  <div className={`break-words text-[15px] font-semibold ${t.status === "done" ? "text-muted line-through" : "text-fg"}`}>{t.title}</div>
                  <div className="text-[13px] text-muted">
                    {DUE_STATUS[t.status]} · due {time.format(new Date(t.due))}
                  </div>
                </div>
                <Points value={t.points} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Adding pressure ${when}`}>
        {e.contributors.length === 0 ? (
          <Empty>Nothing adds pressure {when}.</Empty>
        ) : (
          <ul className="m-0 list-none p-0">{e.contributors.map(row)}</ul>
        )}
        <p className="mt-2 mb-0 text-xs text-muted">
          Includes tasks due later, overdue work, undated tasks and events in the {WINDOW_DAYS} days from {e.isToday ? "now" : "the day's start"}, not only what is due this day.
        </p>
      </Section>

      {!e.isToday && (
        <Section title={`Assumed finished before ${day}`}>
          {e.assumedDone.length === 0 ? (
            <Empty>No open tasks fall due before then.</Empty>
          ) : (
            <ul className="m-0 list-none p-0">
              {e.assumedDone.map((t) => (
                <li key={t.id} className="flex items-center gap-3 border-t border-line py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="break-words text-[15px] font-semibold text-fg">{t.title}</div>
                    <div className="text-[13px] text-muted">Due {time.format(new Date(t.due))} · left out of this day</div>
                  </div>
                  <Points />
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      <Section title="How this day is calculated">
        <ul className="m-0 list-disc border-t border-line py-2.5 pl-5 text-sm text-body">
          {assumptionLines(e, timeZone).map((line) => (
            <li key={line} className="mb-1 last:mb-0">
              {line}
            </li>
          ))}
        </ul>
      </Section>
    </section>
  );
}
