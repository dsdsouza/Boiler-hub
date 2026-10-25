"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/Card";
import { CalendarFeedForm } from "./SourceForms";
import type { AddedSource } from "./api";

const OPTIONS = [
  { id: "schedule", label: "Class schedule", path: <><path d="m3 9 9-5 9 5-9 5-9-5Zm4 3v5c3 3 7 3 10 0v-5m4-3v7" /></> },
  { id: "calendar", label: "Calendar feed", path: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2" /></> },
] as const;

/** Keep each draft mounted while switching connection types. */
export function SourceConnections({ onAdded }: { onAdded: (r: AddedSource) => void }) {
  const uid = useId();
  const [selected, setSelected] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const keyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = e.key === "ArrowRight" ? (index + 1) % OPTIONS.length
      : e.key === "ArrowLeft" ? (index + OPTIONS.length - 1) % OPTIONS.length
      : e.key === "Home" ? 0 : e.key === "End" ? OPTIONS.length - 1 : null;
    if (next === null) return;
    e.preventDefault(); setSelected(next); tabs.current[next]?.focus();
  };
  return (
    <Card as="section" id="class-schedule" aria-labelledby={`${uid}-title`} className="scroll-mt-24 overflow-hidden">
      <div className="px-5 pt-6 pb-5 sm:px-7">
        <CardTitle id={`${uid}-title`}>Connect a source</CardTitle>
      </div>
      <div role="tablist" aria-label="Source type" className="grid grid-cols-2 border-y border-line bg-bg-2 px-2 sm:px-5">
        {OPTIONS.map((option, index) => <button
          key={option.id}
          type="button"
          role="tab"
          id={`${uid}-${option.id}-tab`}
          aria-controls={`${uid}-${option.id}-panel`}
          aria-selected={selected === index}
          tabIndex={selected === index ? 0 : -1}
          ref={el => { tabs.current[index] = el; }}
          onKeyDown={e => keyDown(e, index)}
          onClick={() => setSelected(index)}
          className={`bp-control relative flex min-h-[72px] min-w-0 cursor-pointer flex-col items-center justify-center gap-1.5 px-1 py-3 text-center text-xs font-semibold sm:flex-row sm:gap-2.5 sm:text-sm ${selected === index ? "text-brass-ink after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brass" : "text-muted hover:bg-surface hover:text-fg"}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">{option.path}</svg>
          {option.label}
        </button>)}
      </div>
      {OPTIONS.map((option, index) => <div key={option.id} role="tabpanel" id={`${uid}-${option.id}-panel`} aria-labelledby={`${uid}-${option.id}-tab`} hidden={selected !== index} className={selected !== index ? "hidden" : "px-5 py-6 sm:px-7"}>
        <h3 className="mt-0 mb-2 text-lg font-semibold text-fg">{index === 0 ? "Import your class schedule" : "Connect a calendar"}</h3>
        <Link href={index === 0 ? "/calendar-helper?guide=schedule" : "/calendar-helper"} className="mb-5 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">How to find your school calendar link</Link>
        {index === 0 ? <CalendarFeedForm initialProvider="brightspace" showProvider={false} idPrefix="brightspace" onAdded={onAdded} /> : <CalendarFeedForm onAdded={onAdded} />}
      </div>)}
    </Card>
  );
}
