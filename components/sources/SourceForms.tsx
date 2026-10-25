"use client";

import { useRef, useState, type FormEvent } from "react";
import { Feedback } from "@/components/ui/Feedback";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { defaultFeedLabel, isAppleCalendarUrl, isCourseworkUrl } from "@/lib/sources/hints";
import { foundLine, sourcesCall, type AddedSource } from "./api";

/** Paste an ICS link (Apple Calendar, coursework, or another feed). Shared with onboarding. */
type CalendarProvider = "other" | "apple" | "brightspace";

export function CalendarFeedForm({ onAdded, idPrefix = "feed", initialProvider = "other", showProvider = true, initialUrl = "", onBusyChange }: {
  onAdded?: (r: AddedSource) => void;
  idPrefix?: string;
  initialProvider?: CalendarProvider;
  showProvider?: boolean;
  initialUrl?: string;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [provider, setProvider] = useState<CalendarProvider>(() => isAppleCalendarUrl(initialUrl) ? "apple" : initialProvider);
  const [url, setUrl] = useState(initialUrl);
  const urlField = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState("");
  // Follows the URL (on for Brightspace and Canvas) until the user sets it.
  const [coursework, setCoursework] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const isCoursework = coursework ?? (provider === "brightspace" || isCourseworkUrl(url));
  const isApple = provider === "apple";
  const isBrightspace = provider === "brightspace";

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (provider === "apple" && !isAppleCalendarUrl(url)) {
      setError("Paste the public calendar link from iCloud. In Calendar, enable Public Calendar, then copy its webcal:// link.");
      setDone(null);
      return;
    }
    setBusy(true);
    onBusyChange?.(true);
    setError(null);
    setDone(null);
    try {
      const r = await sourcesCall<AddedSource>("/api/sources", "POST", {
        kind: "ics",
        url: url.trim(),
        coursework: isApple ? false : isCoursework,
        ...(label.trim() ? { label: label.trim() } : isBrightspace ? { label: "Brightspace" } : {}),
      });
      setDone(`${r.source.label} connected. ${foundLine(r)}.${r.warning ? ` ${r.warning}` : ""}`);
      setUrl("");
      setLabel("");
      setCoursework(null);
      onAdded?.(r);
      urlField.current?.focus();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={submit} className="flex flex-col gap-3">
        {showProvider && <Field htmlFor={`${idPrefix}-provider`} label="Calendar provider">
          <Select
            id={`${idPrefix}-provider`}
            value={provider}
            disabled={busy}
            onChange={(e) => {
              setProvider(e.target.value as CalendarProvider);
              setCoursework(null);
              setError(null);
              setDone(null);
            }}
          >
            <option value="other">Other calendar feed</option>
            <option value="brightspace">Brightspace (D2L)</option>
            <option value="apple">Apple Calendar (iCloud)</option>
          </Select>
        </Field>}
        {isApple && <AppleCalendarHelp />}
        <Field htmlFor={`${idPrefix}-url`} label={isApple ? "iCloud public calendar link" : isBrightspace ? "Brightspace subscription link" : "Calendar feed link (.ics or webcal://)"}>
          <Input
            ref={urlField}
            id={`${idPrefix}-url`}
            type="url"
            inputMode="url"
            required
            readOnly={busy}
            maxLength={2048}
            autoComplete="off"
            spellCheck={false}
            placeholder={isApple ? "webcal://p123-caldav.icloud.com/published/2/…" : "https://school.brightspace.com/d2l/le/calendar/feed/user/feed.ics?token=…"}
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (showProvider && isAppleCalendarUrl(e.target.value)) setProvider("apple");
              setError(null);
              setDone(null);
            }}
            aria-describedby={error ? `${idPrefix}-error` : undefined}
            aria-invalid={error ? true : undefined}
            className="font-mono"
          />
        </Field>
        <div className="flex flex-wrap items-end gap-3">
          <Field htmlFor={`${idPrefix}-label`} label="Name (optional)" className="min-w-[180px] flex-1">
            <Input
              id={`${idPrefix}-label`}
              maxLength={60}
              readOnly={busy}
              placeholder={isApple ? "Apple Calendar" : url ? defaultFeedLabel(url) : "Brightspace"}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </Field>
          {!isApple && <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-body">
            <input
              type="checkbox"
              checked={isCoursework}
              disabled={busy}
              onChange={(e) => setCoursework(e.target.checked)}
              className="size-5 shrink-0 cursor-pointer accent-(--color-brass)"
            />
            Coursework feed: all-day entries are deadlines
          </label>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" disabled={!url.trim()} aria-disabled={busy || !url.trim()} aria-busy={busy}>
            {busy ? "Checking the feed…" : isApple ? "Connect Apple Calendar" : isBrightspace ? "Import schedule" : "Add feed"}
          </Button>
          <Feedback message={error ?? done} tone={error ? "error" : "success"} id={error ? `${idPrefix}-error` : undefined} />
        </div>
      </form>
    </div>
  );
}

function AppleCalendarHelp() {
  return (
    <div className="flex flex-col gap-2 text-sm text-body">
      <p className="m-0">Connect one iCloud calendar at a time. Boilerplate reads it when you sync; it cannot edit your events.</p>
      <p className="m-0 text-sm text-muted">Public Calendar lets anyone with the link read that calendar. Removing it from Boilerplate stops our reads; turn off Public Calendar in Apple Calendar to revoke the link for everyone. Your Apple Account password is never needed.</p>
    </div>
  );
}
