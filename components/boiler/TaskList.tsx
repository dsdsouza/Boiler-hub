"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { Contribution, LoadItem, Size } from "@/lib/types";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import type { NewTask, TaskMeta } from "./boilerState";
import { SIZE_POINTS, TASK_LOOKAHEAD_DAYS } from "@/lib/pressure/config";
import { isStaleOverdue } from "@/lib/pressure/compute";
import { sourceBadge } from "@/lib/sources/hints";
import { dueText, formatPoints } from "./format";

import { TASK_TABS, TASK_TAB_LABEL, coursesIn, filterByCourse, filterByTab, isTaskTab, sortTasks, tabCounts, type TaskTab } from "./taskView";

const BADGE_INK: Record<string, string> = { manual: "text-muted", team: "text-brass-ink", ics: "text-cool-ink", github: "text-body" };

type DueChoice = "none" | "today" | "tomorrow" | "3d" | "7d";
const DUE_LABEL: Record<DueChoice, string> = { none: "No due date", today: "Today", tomorrow: "Tomorrow", "3d": "In 3 days", "7d": "In a week" };
const DUE_DAYS: Record<Exclude<DueChoice, "none">, number> = { today: 0, tomorrow: 1, "3d": 3, "7d": 7 };

/** End of the working day `days` from now; today rolls to midnight once 5 pm has passed. */
function dueFor(choice: DueChoice, now = new Date()) {
  if (choice === "none") return "";
  const d = new Date(now);
  d.setDate(d.getDate() + DUE_DAYS[choice]);
  d.setHours(17, 0, 0, 0);
  if (d <= now) d.setHours(23, 59, 0, 0);
  return d.toISOString();
}

const TAB_KEY = "bp.tasks.tab";

const EMPTY: Record<TaskTab, string> = {
  open: "Nothing open. Add a task below.",
  done: "No completed or cleared tasks.",
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
  pendingTaskIds,
}: {
  items: LoadItem[];
  contributions: Contribution[];
  onToggle: (id: string, done: boolean) => void;
  onAdd: (task: NewTask) => Promise<boolean>;
  /** Change a task's size. Team assignments keep the size their lead set. */
  onSize?: (id: string, size: Size) => void;
  /** Remove a manual task. */
  onRemove?: (id: string) => void;
  /** Mark reviewed overdue source items complete. */
  onClearOverdue?: () => void | Promise<unknown>;
  /** Source extras (badge label, link) keyed by task id. */
  meta?: Record<string, TaskMeta>;
  courses?: Record<string, string>;
  /** Where to connect or manage sources; hidden when absent (demo). */
  sourcesHref?: string;
  compact?: boolean;
  className?: string;
  pendingTaskIds?: ReadonlySet<string>;
}) {
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const clearReviewRef = useRef<HTMLButtonElement>(null);
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
    (focusNext === "__new" ? titleInput.current : focusNext === "__review" ? clearReviewRef.current : focusNext === "__tab" ? tabRefs.current.get(tab) : toggles.current.get(focusNext))?.focus();
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

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const draft = title;
    const t = title.trim();
    if (!t || adding) return;
    setAdding(true);
    try {
      const saved = await onAdd({ title: t, size, due: dueFor(due) });
      if (saved) { setTitle((current) => current === draft ? "" : current); setTab("open"); setCourse(null); }
    } finally {
      setAdding(false);
    }
  };

  const openTasks = tasks.filter((t) => !t.doneAt);
  const completedTasks = scoped.filter((t) => !!t.doneAt);
  const renderTask = (t: LoadItem) => {
    const saving = pendingTaskIds?.has(t.id) ?? false;
    const done = !!t.doneAt;
    const pts = points.get(t.id);
    const m = meta[t.id];
    const completedLabel = m?.completedInSource ? "Completed in source — reopen there" : "Completed or cleared";
    const sizeEditable = !!onSize && t.source !== "team";
    // Older overdue work remains counted at a lower backlog weight.
    const stale = !done && isStaleOverdue(t.due, now);
    const removable = stale && t.source === "manual" && !!onRemove;
    return (
      <li key={t.id} className="flex items-center gap-3 border-t border-line py-3">
        <button
          type="button"
          ref={(el) => {
            if (el) toggles.current.set(t.id, el);
            else toggles.current.delete(t.id);
          }}
          onClick={(e) => {
            // Only when the click took focus there (keyboard, or a mouse on a focused button).
            if (!done && document.activeElement === e.currentTarget) {
              const open = tab === "done" ? shown : shown.filter((x) => !x.doneAt);
              const i = open.findIndex((x) => x.id === t.id);
              setFocusNext(open[i + 1]?.id ?? open[i - 1]?.id ?? "__new");
            }
            if (done) setFocusNext(tab === "done" ? shown.find((x) => x.id !== t.id)?.id ?? "__tab" : t.id);
            onToggle(t.id, !done);
          }}
          disabled={saving || !!m?.completedInSource}
          aria-busy={saving}
          aria-label={`${m?.completedInSource ? "Completed in source" : done ? "Mark not done" : "Complete"}: ${t.title}`}
          className={`bp-control flex size-11 flex-none cursor-pointer items-center justify-center rounded-lg border-2 ${
            done ? "border-zone-cool bg-zone-cool text-soot disabled:cursor-default" : "border-control bg-transparent hover:border-brass"
          }`}
        >
          {done && (
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l5 5 9-10" />
            </svg>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className={`break-words text-[15px] font-semibold ${done ? "text-muted line-through" : "text-fg"}`}>
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
            {m?.courseName && m.courseName !== courses[t.id] && <span className="break-words text-body">{m.courseName}</span>}
            {stale ? (
              <span className="font-semibold text-hot-ink">
                {t.source === "manual" ? "Older overdue — complete or remove" : "Older overdue — review"}
              </span>
            ) : (
              <span>{saving ? "Saving…" : done ? completedLabel : t.due ? capitalize(dueText(t.due, now)) : "No due date"}</span>
            )}
            {!done && t.due && Date.parse(t.due) > now.getTime() + TASK_LOOKAHEAD_DAYS * 86_400_000 && <span>Outside {TASK_LOOKAHEAD_DAYS}-day score</span>}
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
        <div className="flex shrink-0 flex-col items-end justify-center gap-1 sm:flex-row sm:items-center sm:gap-3">
          {!compact &&
            (sizeEditable ? (
            <Select
              compact
              aria-label={`Size: ${t.title}`}
              disabled={saving}
              value={sizeDraft[t.id] ?? t.size}
              onChange={(e) => changeSize(t.id, e.target.value as Size)}
            >
              {(Object.keys(SIZE_POINTS) as Size[]).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          ) : (
            <span className="rounded border border-rivet px-[7px] py-0.5 font-mono text-xs font-bold text-body">
              <span className="sr-only">Size </span>
              {t.size}
            </span>
          ))}
          {pts !== undefined && (
            <span className={`min-w-0 text-right font-mono text-[13px] sm:min-w-12 sm:text-sm font-bold ${pts < 0 ? "text-cool-ink" : "text-brass-ink"}`}>
              {formatPoints(pts)}
            </span>
          )}
        </div>
      </li>
    );
  };

  return (
    <Card as="section" aria-labelledby="tasks" className={`px-5 py-6 sm:px-7 ${className}`}>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-3"><CardTitle id="tasks">Tasks</CardTitle><span className="rounded-full border border-line px-2.5 py-0.5 text-xs font-medium text-muted tabular-nums">{openTasks.length} open</span></div>
        {sourcesHref && (
          <Link href={sourcesHref} className="text-[13px] font-medium">
            {Object.keys(meta).length > 0 ? "Manage sources" : "Connect coursework"}
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
      {overdue > 0 && onClearOverdue && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-2.5">
          <p className="m-0 text-[13px] text-muted">
            {overdue} overdue from your feeds. Review them before marking them complete.
          </p>
          <Button ref={clearReviewRef} variant="ghost" onClick={() => !clearing && setConfirmClear(true)} aria-disabled={clearing}>
            Review overdue assignments
          </Button>
        </div>
      )}
      {confirmClear && overdue > 0 && onClearOverdue && <div role="group" aria-label="Confirm clearing overdue assignments" className="border-t border-line py-3">
        <p className="mt-0 mb-2 text-sm text-body">Mark {overdue} overdue {overdue === 1 ? "assignment" : "assignments"} complete? They will stop adding pressure. You can restore them below.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" aria-disabled={clearing} aria-busy={clearing} onClick={async () => {
            if (clearing) return;
            setClearing(true);
            try {
              const saved = await onClearOverdue();
              if (saved !== false) { setConfirmClear(false); setFocusNext("__new"); }
              else setFocusNext("__review");
            } finally { setClearing(false); }
          }}>{clearing ? "Saving…" : `Mark ${overdue} done`}</Button>
          <Button variant="ghost" aria-disabled={clearing} onClick={() => { if (clearing) return; setConfirmClear(false); clearReviewRef.current?.focus(); }}>Cancel</Button>
        </div>
      </div>}
      {shown.length === 0 && <p className="m-0 border-t border-line py-3 text-sm text-muted">{tab === "open" && completedTasks.length ? "No open tasks. Review completed or cleared assignments below." : EMPTY[tab]}</p>}
      <ul className="m-0 list-none p-0">
        {shown.map(renderTask)}
      </ul>
      {tab === "open" && completedTasks.length > 0 && <details className="border-t border-line">
        <summary className="bp-summary flex min-h-11 cursor-pointer items-center text-sm font-semibold text-body">Completed or cleared ({completedTasks.length})</summary>
        <ul className="m-0 list-none p-0">{completedTasks.map(renderTask)}</ul>
      </details>}
      </div>
      <form onSubmit={submit} className="bp-task-form border-t border-line pt-4">
        <div className="bp-task-fields">
          <Field htmlFor="nt" label="New task" className="bp-task-title">
            <Input id="nt" ref={titleInput} type="text" required maxLength={120} placeholder="e.g. Draft lab report" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field htmlFor="ns" label="Size">
            <Select id="ns" value={size} onChange={(e) => setSize(e.target.value as Size)}>
              {(Object.keys(SIZE_POINTS) as Size[]).map((s) => (
                <option key={s} value={s}>
                  {s} · {SIZE_POINTS[s]} pts
                </option>
              ))}
            </Select>
          </Field>
          <Field htmlFor="nd" label="Due">
            <Select id="nd" value={due} onChange={(e) => setDue(e.target.value as DueChoice)}>
              {(Object.keys(DUE_LABEL) as DueChoice[]).map((d) => (
                <option key={d} value={d}>
                  {DUE_LABEL[d]}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" variant="primary" aria-disabled={adding} aria-busy={adding} className="bp-task-submit h-11 w-full whitespace-nowrap aria-disabled:cursor-wait aria-disabled:opacity-70">
            {adding ? "Adding…" : "Add task"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
