"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { Contribution, LoadItem, Size } from "@/lib/types";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { NewTask, TaskMeta } from "./boilerState";
import { SIZE_POINTS } from "@/lib/pressure/config";
import { isStaleOverdue } from "@/lib/pressure/compute";
import { sourceBadge } from "@/lib/sources/hints";
import { dueText, formatPoints } from "./format";
import { TASK_TABS, TASK_TAB_LABEL, coursesIn, filterByCourse, filterByTab, isTaskTab, sortTasks, tabCounts, type TaskTab } from "./taskView";

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

const TAB_KEY = "bp.tasks.tab";

const EMPTY: Record<TaskTab, string> = {
  open: "Nothing open. Add a task below.",
  done: "Nothing done in the last two days.",
  all: "No tasks yet. Add one below.",
};

/** Small neutral chip for a task's or event's class, repo or team. */
export function CourseChip({ course }: { course?: string }) {
  if (!course) return null;
  return (
    <span className="max-w-[16ch] truncate rounded border border-line px-1.5 text-[11px] font-semibold text-body" title={course}>
      <span className="sr-only">Class: </span>
      {course}
    </span>
  );
}

function readTab(): TaskTab {
  try {
    const v = localStorage.getItem(TAB_KEY);
    return isTaskTab(v) ? v : "open";
  } catch {
    return "open";
  }
}

function saveTab(tab: TaskTab) {
  try {
    localStorage.setItem(TAB_KEY, tab);
  } catch {
    // Private mode or blocked storage: the tab is just not remembered.
  }
}

const field =
  "min-h-11 w-full rounded-lg border border-line bg-field px-3 text-base text-fg placeholder:text-muted";

export function TaskList({
  items,
  contributions,
  onToggle,
  onAdd,
  onSize,
  onRemove,
  onClearOverdue,
  meta = {},
  courses = {},
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
  /** Remove a manual task. */
  onRemove?: (id: string) => void;
  /** Clear overdue source items without a vent. */
  onClearOverdue?: () => void;
  /** Source extras (badge label, link) keyed by task id. */
  meta?: Record<string, TaskMeta>;
  /** Class label per task id; tasks without one get no chip. */
  courses?: Record<string, string>;
  /** Where to connect or manage sources; hidden when absent (demo). */
  sourcesHref?: string;
  compact?: boolean;
  className?: string;
}) {
  const [title, setTitle] = useState("");
  const [size, setSize] = useState<Size>("M");
  const [due, setDue] = useState<DueChoice>("tomorrow");
  // Open on the server and first paint; the remembered tab is applied after mount (no hydration mismatch).
  const [tab, setTabState] = useState<TaskTab>("open");
  useEffect(() => setTabState(readTab()), []);
  const setTab = (t: TaskTab) => {
    setTabState(t);
    saveTab(t);
  };
  const tabRefs = useRef(new Map<TaskTab, HTMLButtonElement>());
  const [course, setCourse] = useState<string | null>(null);
  // Completing a task re-sorts it to the end. Focus moves to the task that took its place (or the
  // next field) instead of following it, so the next Tab continues through the open tasks.
  const toggles = useRef(new Map<string, HTMLButtonElement>());
  const titleInput = useRef<HTMLInputElement>(null);
  const [focusNext, setFocusNext] = useState<string | null>(null);
  useEffect(() => {
    if (!focusNext) return;
    const el =
      focusNext === "__new" ? titleInput.current
      : focusNext === "__tab" ? tabRefs.current.get(tab)
      : toggles.current.get(focusNext);
    el?.focus();
    setFocusNext(null);
  }, [focusNext, tab]);
  // The size select changes on every arrow key; send only the last choice.
  const sizeTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const [sizeDraft, setSizeDraft] = useState<Record<string, Size>>({});
  const changeSize = (id: string, size: Size) => {
    setSizeDraft((d) => ({ ...d, [id]: size }));
    clearTimeout(sizeTimers.current.get(id));
    sizeTimers.current.set(
      id,
      setTimeout(() => {
        sizeTimers.current.delete(id);
        onSize?.(id, size);
        setSizeDraft((d) => {
          const next = { ...d };
          delete next[id];
          return next;
        });
      }, 600),
    );
  };
  const now = new Date();
  const points = new Map(contributions.map((c) => [c.itemId, c.points]));
  const tasks = sortTasks(items);
  const courseList = coursesIn(tasks, courses);
  // A class with no tasks left (after a sync or a removal) falls back to every class.
  const activeCourse = course !== null && courseList.length > 1 && courseList.includes(course) ? course : null;
  const scoped = filterByCourse(tasks, courses, activeCourse);
  const counts = tabCounts(scoped);
  const shown = filterByTab(scoped, tab);
  const overdue = tasks.filter((t) => !t.doneAt && meta[t.id] && t.due && Date.parse(t.due) < now.getTime()).length;

  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = TASK_TABS.indexOf(tab);
    const n = TASK_TABS.length;
    const next =
      e.key === "ArrowRight" ? TASK_TABS[(i + 1) % n]
      : e.key === "ArrowLeft" ? TASK_TABS[(i + n - 1) % n]
      : e.key === "Home" ? TASK_TABS[0]
      : e.key === "End" ? TASK_TABS[n - 1]
      : undefined;
    if (!next) return;
    e.preventDefault();
    setTab(next);
    tabRefs.current.get(next)?.focus();
  };

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
      <div role="tablist" aria-label="Show tasks" onKeyDown={onTabKey} className="flex gap-1 border-t border-line pt-1">
        {TASK_TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            id={`tasks-tab-${t}`}
            aria-selected={tab === t}
            aria-controls="tasks-panel"
            tabIndex={tab === t ? 0 : -1}
            ref={(el) => {
              if (el) tabRefs.current.set(t, el);
              else tabRefs.current.delete(t);
            }}
            onClick={() => setTab(t)}
            className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 border-b-2 border-transparent px-3 text-sm font-semibold text-muted hover:text-fg aria-selected:border-brass aria-selected:text-fg"
          >
            {TASK_TAB_LABEL[t]}
            <span className="rounded bg-surface-2 px-1.5 font-mono text-xs text-body">{counts[t]}</span>
          </button>
        ))}
      </div>
      {courseList.length > 1 && (
        <div role="group" aria-label="Filter by class" className="flex flex-wrap items-center gap-1.5 border-t border-line py-2">
          {[null, ...courseList].map((c) => (
            <button
              key={c ?? "__all"}
              type="button"
              aria-pressed={activeCourse === c}
              onClick={() => setCourse(c)}
              className="inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-full border border-line px-3 text-[13px] font-semibold text-body hover:border-brass aria-pressed:border-brass aria-pressed:bg-surface-2 aria-pressed:text-fg"
            >
              {activeCourse === c && (
                <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12l5 5 9-10" />
                </svg>
              )}
              {c ?? "All classes"}
            </button>
          ))}
        </div>
      )}
      <div role="tabpanel" id="tasks-panel" aria-labelledby={`tasks-tab-${tab}`}>
        {tab === "open" && overdue > 0 && onClearOverdue && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-2.5">
            <p className="m-0 text-[13px] text-muted">
              {overdue} overdue from your feeds. Already handed in? Clear them without venting.
            </p>
            <Button variant="ghost" onClick={onClearOverdue}>
              Mark all overdue done
            </Button>
          </div>
        )}
        {shown.length === 0 && (
          <p className="m-0 border-t border-line py-3 text-sm text-muted">
            {activeCourse && counts.all === 0 ? `No tasks for ${activeCourse}.` : EMPTY[tab]}
          </p>
        )}
        <ul className="m-0 list-none p-0">
          {shown.map((t) => {
            const done = !!t.doneAt;
            const pts = points.get(t.id);
            const m = meta[t.id];
            const sizeEditable = !!onSize && t.source !== "team";
            // Overdue more than 14 days: off the gauge, kept here until dealt with.
            const stale = !done && isStaleOverdue(t.due, now);
            const removable = stale && t.source === "manual" && !!onRemove;
            return (
              <li key={t.id} className="flex items-center gap-3.5 border-t border-line py-2.5">
                <button
                  type="button"
                  ref={(el) => {
                    if (el) toggles.current.set(t.id, el);
                    else toggles.current.delete(t.id);
                  }}
                  onClick={(e) => {
                    // Only when the click took focus there (keyboard, or a mouse on a focused button).
                    // On Open and Done the task leaves the list; on All a completed one moves to the end.
                    if ((tab !== "all" || !done) && document.activeElement === e.currentTarget) {
                      const peers = tab === "all" ? shown.filter((x) => !x.doneAt) : shown;
                      const i = peers.findIndex((x) => x.id === t.id);
                      setFocusNext(peers[i + 1]?.id ?? peers[i - 1]?.id ?? (tab === "done" ? "__tab" : "__new"));
                    }
                    onToggle(t.id, !done);
                  }}
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
                    <CourseChip course={courses[t.id]} />
                    {stale ? (
                      <span className="font-semibold text-hot-ink">
                        {t.source === "manual" ? "Stale — mark done or remove" : "Stale — mark done"}
                      </span>
                    ) : (
                      <span>{done ? "Done · steam vented" : capitalize(dueText(t.due ?? now.toISOString(), now))}</span>
                    )}
                    {removable && (
                      <button
                        type="button"
                        onClick={() => onRemove!(t.id)}
                        aria-label={`Remove: ${t.title}`}
                        className="inline-flex min-h-11 cursor-pointer items-center px-1 text-[13px] font-semibold text-body underline hover:text-fg"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
                {!compact &&
                  (sizeEditable ? (
                    <select
                      aria-label={`Size: ${t.title}`}
                      value={sizeDraft[t.id] ?? t.size}
                      onChange={(e) => changeSize(t.id, e.target.value as Size)}
                      className="min-h-11 cursor-pointer rounded border border-rivet bg-field px-1.5 font-mono text-base font-bold text-body hover:border-brass"
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
      </div>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-2.5 border-t border-line pt-4">
        <div className="flex basis-full flex-col gap-1.5 sm:basis-auto sm:flex-[1_1_220px]">
          <label htmlFor="nt" className="text-[13px] font-medium text-body">
            New task
          </label>
          <input id="nt" ref={titleInput} type="text" required maxLength={120} placeholder="e.g. Draft lab report" value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
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
