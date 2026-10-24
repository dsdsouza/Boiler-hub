"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { defaultFeedLabel, isCourseworkUrl } from "@/lib/sources/hints";
import { foundLine, sourcesCall, type AddedSource } from "./api";

export const fieldClass =
  "min-h-11 w-full rounded-lg border border-line bg-field px-3 text-[15px] text-fg placeholder:text-muted";
const labelClass = "text-[13px] font-medium text-body";

/** Paste an ICS link (Brightspace, Canvas, Outlook, any feed). Used on /settings/sources and in onboarding. */
export function CalendarFeedForm({ onAdded, idPrefix = "feed" }: { onAdded?: (r: AddedSource) => void; idPrefix?: string }) {
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  // Follows the URL (on for Brightspace and Canvas) until the user sets it.
  const [coursework, setCoursework] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const isCoursework = coursework ?? isCourseworkUrl(url);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const r = await sourcesCall<AddedSource>("/api/sources", "POST", {
        kind: "ics",
        url: url.trim(),
        coursework: isCoursework,
        ...(label.trim() ? { label: label.trim() } : {}),
      });
      setDone(`${r.source.label} connected. ${foundLine(r)}.`);
      setUrl("");
      setLabel("");
      setCoursework(null);
      onAdded?.(r);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-url`} className={labelClass}>
            Calendar feed link (.ics or webcal://)
          </label>
          <input
            id={`${idPrefix}-url`}
            type="url"
            inputMode="url"
            required
            autoComplete="off"
            spellCheck={false}
            placeholder="https://school.brightspace.com/d2l/le/calendar/feed/user/feed.ics?token=…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className={`${fieldClass} font-mono text-[13px]`}
          />
          <span className="text-xs text-muted">The link works like a password. It is stored encrypted and never shown again.</span>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
            <label htmlFor={`${idPrefix}-label`} className={labelClass}>
              Name (optional)
            </label>
            <input
              id={`${idPrefix}-label`}
              maxLength={60}
              placeholder={url ? defaultFeedLabel(url) : "Brightspace"}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className={fieldClass}
            />
          </div>
          <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-body">
            <input
              type="checkbox"
              checked={isCoursework}
              onChange={(e) => setCoursework(e.target.checked)}
              className="size-5 cursor-pointer accent-(--color-brass)"
            />
            Coursework feed: all-day entries are deadlines
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" disabled={busy || !url.trim()}>
            {busy ? "Checking the feed…" : "Add feed"}
          </Button>
          <p aria-live="polite" className="m-0 text-sm">
            {done && <span className="text-cool-ink">{done}</span>}
            {error && <span className="text-redline-ink">{error}</span>}
          </p>
        </div>
      </form>

      <div className="flex flex-col gap-1 border-t border-line pt-3">
        <HowTo title="Brightspace (D2L)">
          Open <strong>Calendar</strong>, choose <strong>Subscribe</strong> (top right), pick <strong>All Courses</strong>, then copy the
          link it shows.
        </HowTo>
        <HowTo title="Canvas">
          Open <strong>Calendar</strong>, then <strong>Calendar Feed</strong> at the bottom of the right sidebar, and copy the URL.
        </HowTo>
        <HowTo title="Outlook">
          In Outlook on the web: <strong>Settings → Calendar → Shared calendars → Publish a calendar</strong>, choose &quot;Can view all
          details&quot;, publish, then copy the <strong>ICS</strong> link.
        </HowTo>
      </div>
    </div>
  );
}

function HowTo({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group text-sm text-body">
      <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-fg marker:text-brass-ink">How to: {title}</summary>
      <p className="mt-0 mb-2 pl-4">{children}</p>
    </details>
  );
}
