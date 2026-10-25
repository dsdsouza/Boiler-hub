"use client";

import { useId } from "react";
import { calendarDay, groupDeadlines, monthDays, parseMonth, shiftMonth, type MonthCalendar } from "@/lib/calendar/month";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const civilDate = (day: string) => new Date(`${day}T12:00:00Z`);
const fullDay = (day: string) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", dateStyle: "full" }).format(civilDate(day));

export function DeadlineCalendar({ month, selected, today, timeZone, data, loading, error, onSelect, onMonth, onToday, onRefresh }: {
  month: string; selected: string; today: string; timeZone: string; data: MonthCalendar; loading: boolean; error: string;
  onSelect: (day: string) => void; onMonth: (month: string) => void; onToday: () => void; onRefresh: () => void;
}) {
  const id = useId();
  const days = monthDays(month);
  const groups = groupDeadlines(data.deadlines, timeZone);
  const due = groups.get(selected) ?? [];
  const title = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(civilDate(`${month}-01`));
  const previous = shiftMonth(month, -1), next = shiftMonth(month, 1);
  const control = "bp-control inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg border border-line bg-surface px-3 text-sm font-medium text-body hover:border-rivet hover:text-fg disabled:cursor-default disabled:opacity-40";
  const move = (event: React.KeyboardEvent<HTMLButtonElement>, day: string) => {
    const offset = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
    if (!offset) return;
    event.preventDefault();
    const date = civilDate(day); date.setUTCDate(date.getUTCDate() + offset);
    const target = date.toISOString().slice(0, 10);
    if (!parseMonth(target.slice(0, 7))) return;
    onSelect(target);
    requestAnimationFrame(() => document.getElementById(`${id}-${target}`)?.focus());
  };
  return <div className="flex flex-col gap-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="m-0 font-display text-[44px] leading-none tracking-[0.02em] sm:text-[56px]">Calendar</h1>
      </div>
      <button type="button" className={control} disabled={loading} onClick={onRefresh}>{loading ? "Loading…" : "Refresh"}</button>
    </div>
    <section aria-label="Deadline calendar" className="overflow-hidden rounded-[14px] border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5">
        <h2 aria-live="polite" className="m-0 font-display text-[32px] leading-none tracking-[0.02em] sm:text-[40px]">{title}</h2>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Previous month" disabled={!parseMonth(previous)} onClick={() => onMonth(previous)} className={`${control} px-0`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg>
          </button>
          <button type="button" onClick={onToday} className={control}>Today</button>
          <button type="button" aria-label="Next month" disabled={!parseMonth(next)} onClick={() => onMonth(next)} className={`${control} px-0`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m10 6 6 6-6 6" /></svg>
          </button>
        </div>
      </div>
      {error && <div role="alert" className="mx-4 mb-4 flex flex-wrap items-center gap-3 text-sm text-hot-ink sm:mx-6"><span>{error}</span><button type="button" className={control} onClick={onRefresh}>Try again</button></div>}
      {!error && data.unavailableSources > 0 && <p role="status" className="mx-4 mb-4 text-sm text-hot-ink sm:mx-6">Some connected sources couldn’t load. Refresh to try again, or check <a href="/settings/sources" className="underline underline-offset-4">Connect</a>.</p>}
      {data.truncated && <p className="mx-4 mb-4 text-sm text-hot-ink sm:mx-6">Showing the first 1,000 saved deadlines, plus imported deadlines.</p>}
      <table aria-label={`${title} deadlines`} className="w-full table-fixed border-collapse">
        <thead><tr>{WEEKDAYS.map((name) => <th scope="col" key={name} className="border-y border-line bg-surface-2 py-2 text-center text-[11px] font-medium text-muted sm:text-xs">{name}</th>)}</tr></thead>
        <tbody>{Array.from({ length: days.length / 7 }, (_, week) => <tr key={week}>{days.slice(week * 7, week * 7 + 7).map((day) => {
          const inMonth = day.startsWith(month), entries = groups.get(day) ?? [], active = selected === day, isToday = today === day;
          return <td key={day} className="border-t border-r border-line p-0 align-top last:border-r-0">
            <button id={`${id}-${day}`} type="button" disabled={!inMonth} aria-current={isToday ? "date" : undefined} aria-pressed={active} aria-label={`${fullDay(day)}, ${inMonth ? `${entries.length} ${entries.length === 1 ? "deadline" : "deadlines"}` : "outside this month"}`} tabIndex={inMonth && active ? 0 : -1}
              onKeyDown={(event) => move(event, day)} onClick={() => onSelect(day)} className={`bp-control flex min-h-[64px] w-full min-w-0 flex-col items-start gap-1 p-1.5 text-left sm:min-h-[128px] sm:gap-2 sm:p-2.5 ${!inMonth ? "bg-bg/40 text-muted/50" : active ? "cursor-pointer bg-brass/10 ring-2 ring-inset ring-brass" : "cursor-pointer text-body hover:bg-surface-2"}`}>
              <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full font-mono text-xs tabular-nums sm:h-7 sm:min-w-7 sm:text-sm ${isToday ? "bg-brass font-bold text-soot" : ""}`}>{Number(day.slice(-2))}</span>
              {inMonth && entries.length > 0 && <>
                <span className="flex items-center gap-1 px-0.5 text-[10px] text-brass-ink sm:hidden"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brass" aria-hidden="true" />{entries.length}<span className="sr-only"> due</span></span>
                <span className="hidden w-full min-w-0 flex-col gap-1 sm:flex">{entries.slice(0, 2).map((entry) => <span key={entry.id} title={entry.title} className="block truncate rounded bg-surface-2 px-1.5 py-1 text-[11px] leading-snug text-body">{entry.title}</span>)}{entries.length > 2 && <span className="px-1 text-[10px] text-muted">+{entries.length - 2} more</span>}</span>
              </>}
            </button>
          </td>;
        })}</tr>)}</tbody>
      </table>
    </section>
    <section aria-labelledby={`${id}-day`} className="min-w-0">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={`${id}-day`} className="m-0 text-lg font-semibold text-fg">{fullDay(selected)}</h2>
        <span className="text-xs text-muted">{due.length} due</span>
      </div>
      {loading ? null : error ? <p className="text-sm text-muted">Your deadlines will appear here once they load.</p> : due.length ? <ul className="m-0 list-none divide-y divide-line border-y border-line p-0">{due.map((deadline) => <li key={deadline.id} className="flex min-w-0 flex-wrap items-start justify-between gap-x-6 gap-y-2 py-4">
        <div className="min-w-0 flex-1"><p className="m-0 text-sm leading-relaxed font-semibold wrap-anywhere text-fg">{deadline.title}</p><p className="mt-1 mb-0 text-xs text-muted">{deadline.course || (deadline.source === "manual" ? "Personal task" : deadline.source === "team" ? "Team assignment" : deadline.source === "ics" ? "Imported deadline" : "GitHub")}</p></div>
        <time dateTime={deadline.dueAt} className={`shrink-0 rounded-md bg-surface px-2.5 py-1.5 font-mono text-xs tabular-nums ${calendarDay(deadline.dueAt, timeZone) < today ? "text-hot-ink" : "text-brass-ink"}`}>{new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(deadline.dueAt))}</time>
      </li>)}</ul> : <p className="m-0 border-y border-line py-6 text-sm text-muted">No deadlines on this day!</p>}
    </section>
  </div>;
}
