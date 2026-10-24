"use client";

import { useEffect, useId, useState } from "react";
import type { Status } from "@/lib/types";
import { Eyebrow } from "@/components/ui/Card";
import { StatusDot } from "@/components/ui/StatusPill";
import { STATUSES, STATUS_META } from "@/components/ui/zones";

/** Status buttons plus an 80-character note. The note saves on blur or Enter. */
export function StatusPicker({
  status,
  note,
  onChange,
}: {
  status: Status;
  note: string;
  onChange: (status: Status, note: string) => void;
}) {
  // Unique per instance: My Boiler renders one picker per breakpoint.
  const uid = useId();
  const [draft, setDraft] = useState(note);
  const [saved, setSaved] = useState(false);

  useEffect(() => setDraft(note), [note]);
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 1800);
    return () => clearTimeout(t);
  }, [saved]);

  const commitNote = () => {
    if (draft.trim() === note) return;
    onChange(status, draft.trim());
    setSaved(true);
  };

  return (
    <div className="flex w-full flex-col gap-2.5">
      <Eyebrow id={`${uid}-label`}>Your status</Eyebrow>
      <div role="group" aria-labelledby={`${uid}-label`} className="grid grid-cols-2 gap-2">
        {STATUSES.map((s) => {
          const on = s === status;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(s, draft.trim())}
              className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-left text-sm font-semibold text-fg ${
                on ? "border-brass bg-surface-2" : "border-line bg-transparent hover:border-rivet"
              }`}
            >
              <StatusDot status={s} size={10} />
              {STATUS_META[s].label}
            </button>
          );
        })}
      </div>
      <p className="m-0 text-[13px] text-muted">{STATUS_META[status].hint}</p>
      <label htmlFor={`${uid}-note`} className="pt-1 text-[13px] font-medium text-body">
        Status note (shown to your teams)
      </label>
      <input
        id={`${uid}-note`}
        type="text"
        maxLength={80}
        value={draft}
        placeholder="e.g. Launch week, back to normal Fri"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitNote}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitNote();
          }
        }}
        className="min-h-11 w-full rounded-lg border border-line bg-field px-3 text-base text-fg placeholder:text-muted"
      />
      <p className="m-0 flex justify-between text-xs text-muted">
        <span>Status never changes your score.</span>
        <span aria-live="polite">{saved ? "Saved" : <span aria-hidden="true">{draft.length}/80</span>}</span>
      </p>
    </div>
  );
}
