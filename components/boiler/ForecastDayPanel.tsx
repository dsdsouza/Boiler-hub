"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import type { Contribution, ForecastDay, LoadItem } from "@/lib/types";
import { ZoneBadge } from "@/components/ui/ZoneBadge";
import { ZONE_INK, ZONE_LABEL } from "@/components/ui/zones";
import { resolveWeight } from "@/lib/pressure/compute";
import { FORECAST_PANEL_ID } from "./ForecastStrip";
import { CourseChip } from "./TaskList";
import { WEIGHT_LABEL, formatPoints } from "./format";
import { bucketDay } from "./taskView";

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

function longDate(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

/**
 * One forecast day: its score and zone in text, the tasks due (open and done) and the events, each with
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
}: {
  day: ForecastDay;
  isToday: boolean;
  items: LoadItem[];
  contributions: Contribution[];
  courses?: Record<string, string>;
  timeZone: string;
  sheet: boolean;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const panel = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const { tasks, events } = bucketDay(items, day.date, timeZone);
  const points = new Map(contributions.map((c) => [c.itemId, c.points]));
  const time = new Intl.DateTimeFormat(undefined, { timeZone, hour: "numeric", minute: "2-digit" });
  const title = isToday ? `Today, ${longDate(day.date)}` : longDate(day.date);

  // Move focus into the panel when it opens or switches day, so a screen reader starts at its heading.
  useEffect(() => heading.current?.focus(), [day.date]);

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
          : "mt-4 rounded-lg border border-line bg-surface-2 px-5 py-4"
      }
    >
      {sheet && <div aria-hidden="true" className="mx-auto mb-3 h-1 w-10 rounded-full bg-rivet" />}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="fdp-title" ref={heading} tabIndex={-1} className="m-0 font-display text-[26px] leading-none font-normal tracking-[0.03em] outline-none">
            {title}
          </h3>
          <p className="mt-1.5 mb-0 flex flex-wrap items-center gap-2 text-sm text-body">
            <span>
              {isToday ? "Now" : "At the start of the day"}: score{" "}
              <span className={`font-mono font-bold ${ZONE_INK[day.zone]}`}>{day.score}</span> · {ZONE_LABEL[day.zone]}
            </span>
            <span aria-hidden="true">
              <ZoneBadge zone={day.zone} size="sm" />
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-11 min-w-11 flex-none cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-rivet bg-surface px-3 text-sm font-semibold text-fg hover:border-brass"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
          Close
        </button>
      </div>

      <h4 className="mt-5 mb-1 text-base font-semibold">Why this day is {ZONE_LABEL[day.zone]}</h4>
      <p className="mt-0 mb-3 text-sm text-muted">
        {isToday ? "Work adding pressure right now, largest first." : "Work adding pressure at the start of this day, largest first. This includes overdue work and approaching deadlines, even when they fall on another day."}
      </p>
      {contributions.length === 0 ? (
        <p className="m-0 border-t border-line py-2.5 text-sm text-muted">Nothing is adding pressure {isToday ? "right now" : "on this forecast day"}.</p>
      ) : (
        <ul aria-label="Pressure contributors" className="m-0 list-none p-0">
          {contributions.map((c) => (
            <li key={c.itemId} className="flex items-start gap-3 border-t border-line py-2.5">
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
      <p className="mt-2 mb-0 text-xs text-muted">These are workload points; the gauge converts their total to a score from 0 to 100. Future days assume upcoming tasks are completed by their deadlines; work already overdue stays counted.</p>

      <h4 className="mt-4 mb-1 text-[13px] font-semibold tracking-[0.1em] text-muted uppercase">Due</h4>
      {tasks.length === 0 ? (
        <p className="m-0 border-t border-line py-2.5 text-sm text-muted">Nothing due.</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-center gap-3 border-t border-line py-2.5">
              <div className="min-w-0 flex-1">
                <div className={`break-words text-[15px] font-semibold ${t.doneAt ? "text-muted line-through" : "text-fg"}`}>{t.title}</div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-muted">
                  <span>
                    {t.doneAt ? "Done" : "Open"} · due {time.format(new Date(t.due!))}
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
      <p className="mt-3 mb-0 text-xs text-muted">Points above use the selected forecast day. A dash means the item adds no pressure on that day.</p>
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
