"use client";
import type { BoilerResponse } from "@/lib/pressure/api-types";
import { Button } from "@/components/ui/Button";
import { courseworkDeadlines, courseworkSources } from "./setup";

export function DeadlineReview({ boiler, ready, checked, busy, onChange, onRefresh }: {
  boiler: BoilerResponse | null; ready: boolean; checked: boolean; busy: boolean;
  onChange: (checked: boolean) => void; onRefresh: () => void;
}) {
  const tasks = courseworkDeadlines(boiler);
  return <div>
    <p className="mt-0 leading-relaxed text-body">Check the course names, assignment titles and due dates against your school calendar. Pip can plan with the deadlines supplied by your feed; a feed may omit work your instructor has not added.</p>
    {!ready ? <p role="status" className="text-sm text-muted">{busy ? "Reading your coursework…" : "A readable coursework import is needed. Go back to connect your school calendar, or check it again."}</p> : <>
      <p className="font-semibold text-cool-ink">{courseworkSources(boiler).map((s) => s.label).join(", ")} · {tasks.length} imported {tasks.length === 1 ? "deadline" : "deadlines"}</p>
      {tasks.length ? <ol aria-label="Imported coursework deadlines" className="m-0 max-h-64 list-none divide-y divide-line overflow-y-auto p-0">
        {tasks.map((task) => <li key={task.id} className="py-3">
          <p className="m-0 text-sm font-semibold text-fg">{task.title}</p>
          <p className="mt-1 mb-0 text-sm text-body">{task.course || task.courseName || task.sourceLabel}{task.dueAt ? ` · ${new Date(task.dueAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}` : " · No due date supplied"}</p>
        </li>)}
      </ol> : <p className="text-sm text-body">This feed is readable, but it supplies no deadlines in the current import window. Check that you selected All Calendars and Tasks. You can confirm this empty result if it matches your school calendar.</p>}
      <label className="mt-5 flex min-h-11 cursor-pointer items-start gap-3 text-sm leading-relaxed text-body">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-brass" />
        <span>{tasks.length ? "I reviewed these imported deadlines and checked that the feed covers my courses." : "I checked my school calendar and reviewed this feed’s empty deadline result."}</span>
      </label>
    </>}
    <Button className="mt-4" variant="secondary" disabled={busy} onClick={onRefresh}>{busy ? "Checking coursework…" : "Refresh coursework and review again"}</Button>
  </div>;
}
