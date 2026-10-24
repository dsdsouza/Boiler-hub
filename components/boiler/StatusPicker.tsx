"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Status } from "@/lib/types";
import { Eyebrow } from "@/components/ui/Card";
import { StatusDot } from "@/components/ui/StatusPill";
import { STATUSES, STATUS_META } from "@/components/ui/zones";

/** Status buttons plus an 80-character note. The note saves on blur or Enter. */
export function StatusPicker({
  status,
  note,
  onChange,
  labelledBy,
}: {
  status: Status;
  note: string;
  onChange: (status: Status, note: string) => boolean | void | Promise<boolean | void>;
  labelledBy?: string;
}) {
  // Unique per instance: My Boiler renders one picker per breakpoint.
  const uid = useId();
  const [draft, setDraft] = useState(note);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const dirty = useRef(false);
  const draftRef = useRef(note);
  const saveVersion = useRef(0);

  useEffect(() => {
    if (!dirty.current) { draftRef.current = note; setDraft(note); }
  }, [note]);
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 1800);
    return () => clearTimeout(t);
  }, [saved]);

  const save = async (next: Status) => {
    const snapshot = draftRef.current;
    const version = ++saveVersion.current;
    setSaved(false); setFailed(false); setSaving(true);
    try {
      const accepted = await onChange(next, snapshot.trim());
      if (version !== saveVersion.current) return;
      if (accepted === false) { setFailed(true); return; }
      if (draftRef.current === snapshot) {
        dirty.current = false;
        draftRef.current = snapshot.trim();
        setDraft(snapshot.trim()); setSaved(true);
      }
    } catch { if (version === saveVersion.current) setFailed(true); }
    finally { if (version === saveVersion.current) setSaving(false); }
  };
  const commitNote = () => {
    if (draft.trim() === note) return;
    void save(status);
  };

  return (
    <div className="flex w-full flex-col gap-2.5">
      {!labelledBy && <Eyebrow id={`${uid}-label`}>Your status</Eyebrow>}
      <div role="group" aria-labelledby={labelledBy ?? `${uid}-label`} className="grid grid-cols-2 gap-2">
        {STATUSES.map((s) => {
          const on = s === status;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={on}
              onClick={() => { if (!on || draft.trim() !== note) void save(s); }}
              className={`bp-control flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-2.5 text-left text-[13px] font-semibold text-fg ${
                on ? "border-brass bg-surface-2" : "border-control bg-transparent hover:border-brass"
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
        onChange={(e) => { dirty.current = true; draftRef.current = e.target.value; setDraft(e.target.value); setSaved(false); setFailed(false); }}
        onBlur={commitNote}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitNote();
          }
        }}
        className="bp-field min-h-11 w-full rounded-lg border border-line bg-field px-3 text-base text-fg placeholder:text-muted"
      />
      <p className="m-0 flex justify-between text-xs text-muted">
        <span>Status never changes your score.</span>
        <span aria-live="polite">{saving ? "Saving…" : failed ? "Not saved. Try again." : saved ? "Saved" : <span aria-hidden="true">{draft.length}/80</span>}</span>
      </p>
    </div>
  );
}
