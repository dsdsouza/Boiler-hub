"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import type { Contribution, LoadItem, Size } from "@/lib/types";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { NewTask, TaskMeta } from "./boilerState";
import { SIZE_POINTS } from "@/lib/pressure/config";
import { sourceBadge } from "@/lib/sources/hints";
import { dueText, formatPoints } from "./format";

const BADGE_INK: Record<string, string> = { manual: "text-muted", team: "text-brass-ink", ics: "text-cool-ink", github: "text-body" };

type DueChoice = "today" | "tomorrow" | "3d" | "7d";
const DUE_LABEL: Record<DueChoice, string> = { today: "Today", tomorrow: "Tomorrow", "3d": "In 3 days", "7d": "In a week" };
const DUE_DAYS: Record<DueChoice, number> = { today: 0, tomorrow: 1, "3d": 3, "7d": 7 };

/** End of the working day `days` from now; today rolls to midnight once 5 pm has passed. */
function dueFor(choice: DueChoice, now = new Date()) {
  const d = new Date(now);
  d.setDate(d.getDate() + DUE_DAYS[choice]);
  d.setHours(17, 0, 0, 0);
  if (d <= now) d.setHours(23, 59, 0, 0);
  return d.toISOString();
}

const field =
  "min-h-11 w-full rounded-lg border border-line bg-field px-3 text-[15px] text-fg placeholder:text-muted";

export function TaskList({
  items,
  contributions,
  onToggle,
  onAdd,
  onSize,
  onClearOverdue,
  meta = {},
  sourcesHref,
  compact,
  className = "",
}: {
  items: LoadItem[];
  contributions: Contribution[];
  onToggle: (id: string, done: boolean) => void;
  onAdd: (task: NewTask) => void;
  /** Change a task's size. Team assignments keep the size their lead set. */
  onSize?: (id: string, size: Size) => void;
  /** Clear overdue source items without a vent. */
  onClearOverdue?: () => void;
  /** Source extras (badge label, link) keyed by task id. */
  meta?: Record<string, TaskMeta>;
  /** Where to connect or manage sources; hidden when absent (demo). */
  sourcesHref?: string;
  compact?: boolean;
  className?: string;
}) {
  const [title, setTitle] = useState("");
  const [size, setSize] = useState<Size>("M");
  const [due, setDue] = useState<DueChoice>("tomorrow");
  const now = new Date();
  const points = new Map(contributions.map((c) => [c.itemId, c.points]));
  const tasks = items
    .filter((i) => i.kind === "task")
    .sort((a, b) => Number(!!a.doneAt) - Number(!!b.doneAt) || (a.due ?? "").localeCompare(b.due ?? ""));
  const overdue = tasks.filter((t) => !t.doneAt && meta[t.id] && t.due && Date.parse(t.due) < now.getTime()).length;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    onAdd({ title: t, size, due: dueFor(due) });
    setTitle("");
  };

  return (
    <Card as="section" aria-labelledby="tasks" className={`px-5 py-6 sm:px-7 ${className}`}>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <CardTitle id="tasks">Tasks</CardTitle>
        {sourcesHref && (
          <Link href={sourcesHref} className="text-[13px] font-medium">
            {Object.keys(meta).length > 0 ? "Manage sources" : "Connect coursework or GitHub"}
          </Link>
        )}
      </div>
      {overdue > 0 && onClearOverdue && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-2.5">
          <p className="m-0 text-[13px] text-muted">
            {overdue} overdue from your feeds. Already handed in? Clear them without venting.
          </p>
          <Button variant="ghost" onClick={onClearOverdue}>
            Mark all overdue done
          </Button>
        </div>
      )}
      {tasks.length === 0 && <p className="m-0 border-t border-line py-3 text-sm text-muted">No tasks yet. Add one below.</p>}
      <ul className="m-0 list-none p-0">
        {tasks.map((t) => {
          const done = !!t.doneAt;
          const pts = points.get(t.id);
          const m = meta[t.id];
          const sizeEditable = !!onSize && t.source !== "team";
          return (
            <li key={t.id} className="flex items-center gap-3.5 border-t border-line py-2.5">
              <button
                type="button"
                onClick={() => onToggle(t.id, !done)}
                aria-pressed={done}
                aria-label={`${done ? "Mark not done" : "Complete"}: ${t.title}`}
                className={`flex size-11 flex-none cursor-pointer items-center justify-center rounded-lg border-2 ${
                  done ? "border-zone-cool bg-zone-cool" : "border-rivet bg-transparent hover:border-brass"
                }`}
              >
                {done && (
                  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#15120E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12l5 5 9-10" />
                  </svg>
                )}
              </button>
              <div className="min-w-0 flex-1">
                <div className={`text-[15px] font-semibold ${done ? "text-muted line-through" : "text-fg"}`}>
                  {m?.url ? (
                    <a href={m.url} target="_blank" rel="noreferrer" className="text-inherit hover:text-brass-light">
                      {t.title}
                    </a>
                  ) : (
                    t.title
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-muted">
                  <span
                    className={`rounded border border-line px-1.5 font-mono text-[11px] font-bold tracking-[0.06em] uppercase ${BADGE_INK[t.source] ?? "text-muted"}`}
                  >
                    <span className="sr-only">Source: </span>
                    {sourceBadge(t.source, m?.label)}
                  </span>
                  <span>{done ? "Done · steam vented" : capitalize(dueText(t.due ?? now.toISOString(), now))}</span>
                </div>
              </div>
              {!compact &&
                (sizeEditable ? (
                  <select
                    aria-label={`Size: ${t.title}`}
                    value={t.size}
                    onChange={(e) => onSize!(t.id, e.target.value as Size)}
                    className="min-h-11 cursor-pointer rounded border border-rivet bg-field px-1.5 font-mono text-xs font-bold text-body hover:border-brass"
                  >
                    {(Object.keys(SIZE_POINTS) as Size[]).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="rounded border border-rivet px-[7px] py-0.5 font-mono text-xs font-bold text-body">
                    <span className="sr-only">Size </span>
                    {t.size}
                  </span>
                ))}
              {pts !== undefined && (
                <span className={`min-w-12 text-right font-mono text-sm font-bold ${pts < 0 ? "text-cool-ink" : "text-brass-ink"}`}>
                  {formatPoints(pts)}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-2.5 border-t border-line pt-4">
        <div className="flex basis-full flex-col gap-1.5 sm:basis-auto sm:flex-[1_1_220px]">
          <label htmlFor="nt" className="text-[13px] font-medium text-body">
            New task
          </label>
          <input id="nt" type="text" required maxLength={120} placeholder="e.g. Draft lab report" value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-none">
          <label htmlFor="ns" className="text-[13px] font-medium text-body">
            Size
          </label>
          <select id="ns" value={size} onChange={(e) => setSize(e.target.value as Size)} className={field}>
            {(Object.keys(SIZE_POINTS) as Size[]).map((s) => (
              <option key={s} value={s}>
                {s} · {SIZE_POINTS[s]} pts
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-none">
          <label htmlFor="nd" className="text-[13px] font-medium text-body">
            Due
          </label>
          <select id="nd" value={due} onChange={(e) => setDue(e.target.value as DueChoice)} className={field}>
            {(Object.keys(DUE_LABEL) as DueChoice[]).map((d) => (
              <option key={d} value={d}>
                {DUE_LABEL[d]}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="primary" className="w-full sm:w-auto">
          Add task
        </Button>
      </form>
    </Card>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
