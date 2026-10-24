"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AssignmentPreview, Size } from "@/lib/types";
import { movedUp, summarize, type TeamAssignmentPreview } from "@/app/api/teams/_lib/assignment";
import { C, DISPLAY, MONO, ZONE_COLOR, plural } from "../_theme";
import { api } from "./api";

const SIZES: { size: Size; label: string }[] = [
  { size: "S", label: "S · 2" },
  { size: "M", label: "M · 4" },
  { size: "L", label: "L · 8" },
];

function ymd(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function addDays(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return ymd(d);
}
// Due at the end of the chosen local day.
function dueIso(date: string) {
  return new Date(`${date}T23:59:00`).toISOString();
}

const pill = (on: boolean) => ({
  border: `1px solid ${on ? C.brass : C.line}`,
  backgroundColor: on ? C.brass : C.surface,
  color: on ? C.onFill : C.text2,
});

type Posted = { title: string; result: TeamAssignmentPreview; matched: boolean; duplicate: boolean };

/** One key per draft: posting the same draft twice (double click, retry) creates one assignment. */
function newKey() {
  return crypto.randomUUID();
}

export function AssignmentPanel({
  teamId,
  labels,
  onPreview,
}: {
  teamId: string;
  labels: { lead: string; members: string; Members: string };
  onPreview: (p: AssignmentPreview | null) => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => addDays(7));
  const [size, setSize] = useState<Size>("M");
  const [preview, setPreview] = useState<TeamAssignmentPreview | null>(null);
  const [clientKey, setClientKey] = useState(newKey);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState<Posted | null>(null);
  const [, startTransition] = useTransition();
  const reqId = useRef(0);
  const postedRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  // The form is swapped for the result after posting: keep keyboard focus with it.
  useEffect(() => {
    if (posted) postedRef.current?.focus();
  }, [posted]);

  const ready = title.trim().length > 0 && date.length > 0;

  // A changed draft is a new assignment; a retry of the same draft keeps its key.
  useEffect(() => setClientKey(newKey()), [title, date, size]);

  // Live preview, debounced; stale responses are dropped.
  useEffect(() => {
    if (!ready || posted) {
      setPreview(null);
      onPreview(null);
      return;
    }
    const id = ++reqId.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const p = await api<TeamAssignmentPreview>(`/api/teams/${teamId}/assignments/preview`, "POST", {
          title,
          due: dueIso(date),
          size,
        });
        if (id !== reqId.current) return;
        setPreview(p);
        setError(null);
        onPreview(p);
      } catch (e) {
        if (id !== reqId.current) return;
        setPreview(null);
        onPreview(null);
        setError((e as Error).message);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [teamId, title, date, size, ready, posted, onPreview]);

  async function post() {
    if (!preview) return;
    setPosting(true);
    setError(null);
    try {
      const res = await api<{ result: TeamAssignmentPreview | null; duplicate: boolean }>(`/api/teams/${teamId}/assignments`, "POST", {
        title,
        due: dueIso(date),
        size,
        clientKey,
      });
      if (res.duplicate || !res.result) {
        setPosted({ title: title.trim(), result: preview, matched: true, duplicate: true });
      } else {
        const matched = JSON.stringify(res.result) === JSON.stringify(preview);
        setPosted({ title: title.trim(), result: res.result, matched, duplicate: false });
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPosting(false);
    }
  }

  // null: the exact total would reveal a lone hidden member, so the button does not count.
  const recipients = preview ? preview.recipients : undefined;

  return (
    <aside
      aria-labelledby="new-assignment"
      className="plate flex min-w-0 flex-[1_1_340px] flex-col gap-4 rounded-[14px] px-6 py-[26px]"
      style={{ backgroundColor: C.surface, border: `1px solid ${C.rivet}` }}
    >
      <div>
        <h2 id="new-assignment" className={`m-0 text-[32px] tracking-[0.03em] ${DISPLAY}`}>
          New assignment
        </h2>
        <p className="mt-0.5 mb-0 text-[13px]" style={{ color: C.muted }}>
          {labels.lead} only. Preview the pressure before you post.
        </p>
      </div>

      {posted ? (
        <div ref={postedRef} tabIndex={-1} role="status" className="flex flex-col gap-3.5 outline-none">
          <div className="flex flex-col gap-1.5 rounded-[10px] p-4" style={{ backgroundColor: C.bg, border: `1px solid ${ZONE_COLOR.cool}` }}>
            <div className={`text-[28px] tracking-[0.03em] ${DISPLAY}`} style={{ color: ZONE_COLOR.cool }}>
              Posted
            </div>
            <p className="m-0 text-sm leading-normal" style={{ color: C.text2 }}>
              “{posted.title}” is now on every {labels.members.replace(/s$/, "")}’s task list, and their boilers have updated.
            </p>
            <p className={`m-0 text-xs ${MONO}`} style={{ color: posted.matched ? ZONE_COLOR.cool : ZONE_COLOR.hot }}>
              {posted.duplicate
                ? "Already posted. Nothing was added twice."
                : posted.matched
                  ? "✓ Result matches the preview"
                  : "Scores moved slightly since the preview"}
            </p>
          </div>
          <PreviewTable preview={posted.result} labels={labels} />
          <button
            type="button"
            onClick={() => {
              setPosted(null);
              setTitle("");
              setTimeout(() => titleRef.current?.focus(), 0);
            }}
            className="min-h-11 rounded-lg text-sm font-semibold"
            style={{ border: `1px solid ${C.rivet}`, color: C.text, backgroundColor: "transparent" }}
          >
            Draft another
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="a-title" className="text-[13px] font-medium" style={{ color: C.text2 }}>
              Title
            </label>
            <input
              ref={titleRef}
              id="a-title"
              type="text"
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Lab report: enzyme kinetics"
              className="min-h-11 w-full rounded-lg px-3 text-base outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ backgroundColor: C.field, color: C.text, border: `1px solid ${C.line}`, outlineColor: C.brassLight }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="a-due" className="text-[13px] font-medium" style={{ color: C.text2 }}>
              Due
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Tomorrow", d: 1 },
                { label: "In 3 days", d: 3 },
                { label: "In a week", d: 7 },
              ].map((q) => {
                const v = addDays(q.d);
                return (
                  <button key={q.d} type="button" aria-pressed={date === v} onClick={() => setDate(v)} className="min-h-11 rounded-lg text-sm font-semibold" style={pill(date === v)}>
                    {q.label}
                  </button>
                );
              })}
            </div>
            <input
              id="a-due"
              type="date"
              value={date}
              min={addDays(0)}
              onChange={(e) => setDate(e.target.value)}
              className={`min-h-11 w-full rounded-lg px-3 text-base [color-scheme:dark] ${MONO}`}
              style={{ backgroundColor: C.field, color: C.text, border: `1px solid ${C.line}` }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span id="a-size" className="text-[13px] font-medium" style={{ color: C.text2 }}>
              Size
            </span>
            <div role="group" aria-labelledby="a-size" className="grid grid-cols-3 gap-2">
              {SIZES.map((s) => (
                <button key={s.size} type="button" aria-pressed={size === s.size} onClick={() => setSize(s.size)} className="min-h-11 rounded-lg text-sm font-semibold" style={pill(size === s.size)}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div role="status" aria-busy={loading} className="flex flex-col gap-3 rounded-[10px] p-4" style={{ backgroundColor: C.bg, border: `1px solid ${C.line}` }}>
            <div className="text-xs font-semibold tracking-[0.12em]" style={{ color: C.muted }}>
              PRESSURE PREVIEW
            </div>
            {preview ? (
              <PreviewTable preview={preview} labels={labels} />
            ) : (
              <div className={`text-[30px] leading-[1.05] tracking-[0.02em] ${DISPLAY}`} style={{ color: C.text }}>
                {ready ? (loading ? "Reading the gauges…" : "No preview") : "Add a title to preview"}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={post}
            disabled={!preview || loading || posting || recipients === 0}
            className={`min-h-[52px] rounded-lg text-2xl tracking-[0.05em] disabled:opacity-50 ${DISPLAY}`}
            style={{ backgroundColor: C.brass, color: C.onFill, boxShadow: "inset 0 -3px 0 #8C6A35" }}
          >
            {posting
              ? "Posting…"
              : recipients === undefined
                ? "Post"
                : recipients === null
                  ? `Post to all ${labels.members}`
                  : recipients === 0
                    ? `No ${labels.members} to post to`
                    : `Post to ${plural(recipients, labels.members.replace(/s$/, ""), labels.members)}`}
          </button>
          <p className="m-0 text-xs" style={{ color: C.muted }}>
            The preview adds this task to each stored snapshot. No calendars are re-read.
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="m-0 text-sm" style={{ color: ZONE_COLOR.redline }}>
          {error}
        </p>
      )}
    </aside>
  );
}

function PreviewTable({ preview, labels }: { preview: TeamAssignmentPreview; labels: { members: string } }) {
  const s = summarize(preview);
  const color = s.intoRedline ? ZONE_COLOR.redline : s.intoHot ? ZONE_COLOR.hot : C.text;
  const { count, intoRedline } = preview.hidden;
  const one = labels.members.replace(/s$/, "");
  return (
    <>
      <div className={`text-[30px] leading-[1.05] tracking-[0.02em] ${DISPLAY}`} style={{ color }}>
        {s.text}
      </div>
      <div className="flex flex-col">
        {preview.members.map((m) => (
          <div key={m.userId} className="flex items-center justify-between gap-2 py-[7px] text-sm" style={{ borderTop: `1px solid ${C.surface2}` }}>
            <span className="min-w-0 truncate">{m.name}</span>
            <span className={`whitespace-nowrap font-bold ${MONO}`}>
              <span style={{ color: ZONE_COLOR[m.zoneBefore] }}>{m.before}</span>
              <span style={{ color: C.muted }}> → </span>
              <span style={{ color: ZONE_COLOR[m.zoneAfter] }}>{m.after}</span>
              {/* Zone as text, not just color: "WORKING ▲ HOT" when it moves, else the zone it stays in. */}
              <span className="text-[11px]" style={{ color: movedUp(m) ? ZONE_COLOR[m.zoneAfter] : C.muted }}>
                {movedUp(m) ? `  ${m.zoneBefore.toUpperCase()} ▲ ${m.zoneAfter.toUpperCase()}` : `  ${m.zoneAfter.toUpperCase()}`}
              </span>
            </span>
          </div>
        ))}
        {count > 0 && (
          <div className="pt-[9px] text-[13px]" style={{ borderTop: `1px solid ${C.surface2}`, color: C.muted }}>
            + {plural(count, `hidden ${one}`, `hidden ${labels.members}`)} ·{" "}
            {intoRedline ? `${intoRedline} would cross into Redline` : "no Redline crossing"}
          </div>
        )}
        {preview.noRecentData.length > 0 && (
          <div className="pt-[9px] text-[13px]" style={{ borderTop: `1px solid ${C.surface2}`, color: C.muted }}>
            {plural(preview.noRecentData.length, one, labels.members)} {preview.noRecentData.length === 1 ? "has" : "have"} no recent data
            (never synced or older than 3 days), so {preview.noRecentData.length === 1 ? "is" : "are"} left out of the summary:{" "}
            {preview.noRecentData.map((m) => m.name).join(", ")}.
          </div>
        )}
        {preview.members.length === 0 && count === 0 && preview.noRecentData.length === 0 && (
          <div className="pt-[9px] text-[13px]" style={{ color: C.muted }}>
            No {labels.members} on this team yet.
          </div>
        )}
      </div>
    </>
  );
}
