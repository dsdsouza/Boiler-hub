"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import type { Contribution, ForecastDay, LoadItem } from "@/lib/types";
import { ZoneBadge } from "@/components/ui/ZoneBadge";
import { resolveWeight } from "@/lib/pressure/compute";
import { FORECAST_PANEL_ID } from "./ForecastStrip";
import { CourseChip } from "./TaskList";
import { WEIGHT_LABEL, formatPoints } from "./format";
import { bucketDay } from "./taskView";
import type { TaskMeta } from "./boilerState";

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

function longDate(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

/**
 * One forecast day: its zone, the tasks due (open and done) and the events, each with
 * its class chip and forecast points. All contributors explain the selected score, even if due later.
 * `sheet` is the phone bottom sheet (modal, focus trapped); otherwise
 * it is an inline panel under the strip. Esc and Close call `onClose`, which returns focus to the day.
 */
export function ForecastDayPanel({
  day,
  isToday,
  items,
  contributions,
  courses = {},
  timeZone,
  sheet,
  onClose,
  onToggle,
  taskMeta = {},
  pendingTaskIds,
}: {
  day: ForecastDay;
  isToday: boolean;
  items: LoadItem[];
  contributions: Contribution[];
  courses?: Record<string, string>;
  timeZone: string;
  sheet: boolean;
  onClose: () => void;
  onToggle: (id: string, done: boolean) => void | boolean | Promise<void | boolean>;
  taskMeta?: Record<string, TaskMeta>;
  pendingTaskIds?: ReadonlySet<string>;
}) {
  const reduce = useReducedMotion();
  const panel = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const noticeElement = useRef<HTMLParagraphElement>(null);
  const pending = useRef(new Set<string>());
  const [savingIds, setSavingIds] = useState<ReadonlySet<string>>(new Set());
  const [notice, setNotice] = useState<{ taskId: string; error: boolean; text: string } | null>(null);
  const [undoId, setUndoId] = useState<string | null>(null);
  const byId = new Map(items.map((item) => [item.id, item]));
  const undoTask = undoId ? byId.get(undoId) : undefined;
  const { tasks, events } = bucketDay(items, day.date, timeZone);
  const points = new Map(contributions.map((c) => [c.itemId, c.points]));
  const time = new Intl.DateTimeFormat(undefined, { timeZone, hour: "numeric", minute: "2-digit" });
  const title = isToday ? `Today, ${longDate(day.date)}` : longDate(day.date);

  const toggleTask = async (task: LoadItem, done: boolean) => {
    if (pending.current.has(task.id) || pendingTaskIds?.has(task.id) || taskMeta[task.id]?.completedInSource) return;
    pending.current.add(task.id);
    setSavingIds(new Set(pending.current));
    setNotice({ taskId: task.id, error: false, text: `Saving “${task.title}”…` });
    try {
      const saved = await onToggle(task.id, done);
      if (saved === false) throw new Error("Task was not saved");
      setNotice({ taskId: task.id, error: false, text: `“${task.title}” marked ${done ? "done" : "not done"}.` });
      if (done) setUndoId(task.id);
      else setUndoId((id) => id === task.id ? null : id);
    } catch {
      setNotice({ taskId: task.id, error: true, text: `Couldn’t save “${task.title}”. Try again.` });
    } finally {
      pending.current.delete(task.id);
      setSavingIds(new Set(pending.current));
    }
  };

  const taskToggle = (task: LoadItem, contributor = false) => {
    const done = !!task.doneAt;
    const saving = savingIds.has(task.id);
    const sourceDone = !!taskMeta[task.id]?.completedInSource;
    return (
      <button
        type="button"
        disabled={pendingTaskIds?.has(task.id) || sourceDone}
        aria-disabled={saving || undefined}
        aria-busy={saving}
        aria-label={`${sourceDone ? "Completed in source" : done ? "Mark not done" : "Complete"}: ${task.title}`}
        onClick={(event) => {
          if (pending.current.has(task.id)) return;
          // Completing a contributor removes its row. Keep keyboard focus in the panel.
          if (contributor && !done && document.activeElement === event.currentTarget) {
            requestAnimationFrame(() => heading.current?.focus());
          }
          void toggleTask(task, !done);
        }}
        className={`bp-control flex size-11 flex-none cursor-pointer items-center justify-center rounded-lg border-2 disabled:cursor-default disabled:opacity-60 aria-disabled:cursor-wait aria-disabled:opacity-70 ${done ? "border-zone-cool bg-zone-cool text-soot" : "border-control bg-transparent hover:border-brass"}`}
      >
        {done && <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10" /></svg>}
      </button>
    );
  };

  // Move focus into the panel when it opens or switches day, so a screen reader starts at its heading.
  useEffect(() => heading.current?.focus(), [day.date]);

  useEffect(() => {
    if (notice?.error) noticeElement.current?.scrollIntoView({ block: "nearest" });
  }, [notice]);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!sheet) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sheet]);

  // The sheet is modal: Tab cycles inside it.
  const trap = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!sheet || e.key !== "Tab" || !panel.current) return;
    const els = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (els.length === 0) return;
    const first = els[0]!;
    const last = els[els.length - 1]!;
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === heading.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const pts = (id: string) => {
    const p = points.get(id);
    return (
      <span className={`min-w-12 flex-none text-right font-mono text-sm font-bold ${p === undefined ? "text-muted" : p < 0 ? "text-cool-ink" : "text-brass-ink"}`}>
        {p === undefined ? <span aria-label="no points">—</span> : formatPoints(p)}
      </span>
    );
  };

  const body = (
    <motion.div
      ref={panel}
      key={day.date}
      initial={reduce ? false : sheet ? { y: "100%" } : { opacity: 0, y: -4 }}
      animate={sheet ? { y: 0 } : { opacity: 1, y: 0 }}
      transition={{ type: "tween", duration: sheet ? 0.22 : 0.18, ease: "easeOut" }}
      id={FORECAST_PANEL_ID}
      role={sheet ? "dialog" : "region"}
      aria-modal={sheet || undefined}
      aria-labelledby="fdp-title"
      onKeyDown={trap}
      className={
        sheet
          ? "fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-[14px] border-t border-rivet bg-surface px-4 pt-3 pb-[max(env(safe-area-inset-bottom),16px)] shadow-(--shadow)"
          : "relative mt-4 rounded-lg border border-line bg-surface-2 px-5 py-4"
      }
    >
      {sheet && <div aria-hidden="true" className="mx-auto mb-3 h-1 w-10 rounded-full bg-rivet" />}
      <div className="flex items-start gap-3 pr-10">
        <div className="min-w-0">
          <h3 id="fdp-title" ref={heading} tabIndex={-1} className="m-0 font-display text-[26px] leading-none font-normal tracking-[0.03em] outline-none">
            {title}
          </h3>
          <div aria-live="polite" aria-atomic="true" className="mt-1.5">
            <ZoneBadge zone={day.zone} size="sm" />
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          title="Close"
          className="bp-control bp-close-button absolute top-2 right-2 inline-flex h-11 w-11 cursor-pointer items-center justify-center border-0 p-0"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      {notice && <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <p ref={noticeElement} role={notice.error ? "alert" : "status"} className={`m-0 min-w-0 max-w-full break-words text-sm ${notice.error ? "text-redline-ink" : "text-body"}`}>{notice.text}</p>
        {undoTask?.doneAt && notice.taskId === undoTask.id && !taskMeta[undoTask.id]?.completedInSource && <button
          type="button"
          aria-label={`Undo completion: ${undoTask.title}`}
          aria-disabled={savingIds.has(undoTask.id) || undefined}
          onClick={(event) => {
            if (pending.current.has(undoTask.id)) return;
            if (document.activeElement === event.currentTarget) requestAnimationFrame(() => heading.current?.focus());
            void toggleTask(undoTask, false);
          }}
          className="min-h-11 cursor-pointer border-0 bg-transparent px-0 text-sm font-semibold text-brass-ink underline underline-offset-4 aria-disabled:cursor-wait aria-disabled:opacity-70"
        >Undo completion</button>}
      </div>}
      {contributions.length === 0 ? (
        <p className="mt-4 mb-0 border-t border-line py-2.5 text-sm text-muted">Nothing is adding pressure {isToday ? "right now" : "on this forecast day"}.</p>
      ) : (
        <ul aria-label="Pressure contributors" className="mt-4 mb-0 list-none p-0">
          {contributions.map((c) => (
            <li key={c.itemId} className="flex items-start gap-3 border-t border-line py-2.5">
              {byId.get(c.itemId)?.kind === "task" && taskToggle(byId.get(c.itemId)!, true)}
              <div className="min-w-0 flex-1">
                <div className="break-words text-[15px] font-semibold text-fg">{c.title}</div>
                <div className="text-[13px] text-muted">{c.reason}</div>
                <CourseChip course={courses[c.itemId]} />
              </div>
              {pts(c.itemId)}
            </li>
          ))}
        </ul>
      )}

      <h4 className="mt-4 mb-1 text-[13px] font-semibold tracking-[0.1em] text-muted uppercase">Due</h4>
      {tasks.length === 0 ? (
        <p className="m-0 border-t border-line py-2.5 text-sm text-muted">Nothing due.</p>
      ) : (
        <ul aria-label="Tasks due this day" className="m-0 list-none p-0">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-center gap-3 border-t border-line py-2.5">
              {taskToggle(t)}
              <div className="min-w-0 flex-1">
                <div className={`break-words text-[15px] font-semibold ${t.doneAt ? "text-muted line-through" : "text-fg"}`}>{t.title}</div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-muted">
                  <span>
                    {taskMeta[t.id]?.completedInSource ? "Completed in source — reopen there" : savingIds.has(t.id) || pendingTaskIds?.has(t.id) ? "Saving…" : t.doneAt ? "Done" : "Open"} · due {time.format(new Date(t.due!))}
                  </span>
                  <CourseChip course={courses[t.id]} />
                </div>
              </div>
              {pts(t.id)}
            </li>
          ))}
        </ul>
      )}

      <h4 className="mt-4 mb-1 text-[13px] font-semibold tracking-[0.1em] text-muted uppercase">Events</h4>
      {events.length === 0 ? (
        <p className="m-0 border-t border-line py-2.5 text-sm text-muted">No events.</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {events.map((e) => (
            <li key={e.id} className="flex items-center gap-3 border-t border-line py-2.5">
              <div className="min-w-0 flex-1">
                <div className="break-words text-[15px] font-semibold text-fg">{e.title}</div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-muted">
                  <span>
                    {time.format(new Date(e.start!))}
                    {e.end ? `–${time.format(new Date(e.end))}` : ""} ·{" "}
                    {e.release ? "Excluded from pressure" : WEIGHT_LABEL[resolveWeight(e)]}
                  </span>
                  <CourseChip course={courses[e.id]} />
                </div>
              </div>
              {pts(e.id)}
            </li>
          ))}
        </ul>
      )}
    </motion.div>
  );

  if (!sheet) return body;

  return createPortal(
    <>
      <div aria-hidden="true" onClick={onClose} className="fixed inset-0 z-50 bg-black/50" />
      {body}
    </>,
    document.body,
  );
}
