"use client";

import { useRef, useState, type FormEvent } from "react";
import { Feedback } from "@/components/ui/Feedback";
import { Button } from "@/components/ui/Button";
import { defaultFeedLabel, isAppleCalendarUrl, isCourseworkUrl } from "@/lib/sources/hints";
import { foundLine, sourcesCall, type AddedSource } from "./api";

export const fieldClass =
  "bp-field min-h-11 w-full rounded-lg border border-line bg-field px-3 text-base text-fg placeholder:text-muted";
const labelClass = "text-[13px] font-medium text-body";

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
        {showProvider && <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-provider`} className={labelClass}>Calendar provider</label>
          <select
            id={`${idPrefix}-provider`}
            value={provider}
            disabled={busy}
            onChange={(e) => {
              setProvider(e.target.value as CalendarProvider);
              setCoursework(null);
              setError(null);
              setDone(null);
            }}
            className={fieldClass}
          >
            <option value="other">Coursework or other calendar feed</option>
            <option value="brightspace">Brightspace (D2L)</option>
            <option value="apple">Apple Calendar (iCloud)</option>
          </select>
        </div>}
        {isApple && <AppleCalendarHelp />}
        {isBrightspace && <BrightspaceHelp />}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-url`} className={labelClass}>
            {isApple ? "iCloud public calendar link" : isBrightspace ? "Brightspace subscription link" : "Calendar feed link (.ics or webcal://)"}
          </label>
          <input
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
            aria-describedby={`${idPrefix}-link-help${error ? ` ${idPrefix}-error` : ""}`}
            aria-invalid={error ? true : undefined}
            className={`${fieldClass} font-mono text-base`}
          />
          <span id={`${idPrefix}-link-help`} className="text-xs text-muted">The link works like a password. It is stored encrypted and never shown again.</span>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
            <label htmlFor={`${idPrefix}-label`} className={labelClass}>
              Name (optional)
            </label>
            <input
              id={`${idPrefix}-label`}
              maxLength={60}
              readOnly={busy}
              placeholder={isApple ? "Apple Calendar" : url ? defaultFeedLabel(url) : "Brightspace"}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className={fieldClass}
            />
          </div>
          {!isApple && <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-body">
            <input
              type="checkbox"
              checked={isCoursework}
              disabled={busy}
              onChange={(e) => setCoursework(e.target.checked)}
              className="size-5 cursor-pointer accent-(--color-brass)"
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

      {!isApple && !isBrightspace && <div className="flex flex-col gap-1 border-t border-line pt-3">
        <HowTo title="Brightspace (D2L)">
          Open <strong>Calendar → Settings</strong>, enable <strong>Calendar Feeds</strong>, then choose <strong>Subscribe → All Calendars and Tasks</strong> and copy the link.
        </HowTo>
        <HowTo title="Canvas">
          Open <strong>Calendar</strong>, then <strong>Calendar Feed</strong> at the bottom of the right sidebar, and copy the URL.
        </HowTo>
        <HowTo title="Moodle">
          Open <strong>Calendar → Export calendar</strong>. Choose your courses and <strong>Recent and next 60 days</strong> or a custom
          range covering the term. Select <strong>Get calendar URL</strong> and copy the link, rather than downloading a file.
        </HowTo>
        <HowTo title="Blackboard">
          Open <strong>Calendar</strong>, then its settings or sharing menu. Choose <strong>Share calendar</strong> (Ultra) or
          <strong> Get External Calendar Link</strong> (Original), then copy the iCalendar link.
        </HowTo>
        <HowTo title="Outlook">
          In Outlook on the web: <strong>Settings → Calendar → Shared calendars → Publish a calendar</strong>, choose &quot;Can view all
          details&quot;, publish, then copy the <strong>ICS</strong> link.
        </HowTo>
      </div>}
    </div>
  );
}

function BrightspaceHelp() {
  return (
    <details className="rounded-[10px] border border-line px-3 text-sm text-body">
      <summary className="bp-summary flex min-h-11 cursor-pointer items-center font-semibold text-fg">Find your Brightspace link</summary>
      <div className="pb-3">
      <ol className="mt-0 mb-3 list-decimal space-y-1.5 pl-5">
        <li>In Brightspace, open <strong>Calendar → Settings</strong>.</li>
        <li>Turn on <strong>Enable Calendar Feeds</strong> and save.</li>
        <li>Choose <strong>Subscribe → All Calendars and Tasks</strong>, then copy the subscription link.</li>
      </ol>
      <p className="mt-0 mb-2">Classes on that calendar appear in your schedule; assignment deadlines appear in Tasks. Refresh My Boiler to pick up changes.</p>
      <p className="mt-0 mb-2 text-muted">Missing class times? Brightspace only includes events posted there. For Purdue’s official timetable, check myPurdue → Academic Profile → Student Profile → My Courses. You can also connect a timetable calendar feed below.</p>
      <a href="https://community.d2l.com/brightspace/kb/articles/18042-manage-course-events-with-the-calendar-tool" target="_blank" rel="noreferrer" className="underline underline-offset-2">Brightspace’s calendar guide</a>
      </div>
    </details>
  );
}

function AppleCalendarHelp() {
  return (
    <div className="flex flex-col gap-2 text-sm text-body">
      <p className="m-0">Connect one iCloud calendar at a time. Boiler Hub reads it when you sync; it cannot edit your events.</p>
      <details className="text-sm">
        <summary className="bp-summary flex min-h-11 cursor-pointer items-center font-semibold text-fg">Get your iCloud calendar link</summary>
        <p className="mt-0 mb-2"><strong>iPhone or iPad:</strong> open Calendar → Calendars, tap the info button beside an iCloud calendar, then turn on Public Calendar. Tap Share Link → Copy.</p>
        <p className="mt-0 mb-2"><strong>Mac:</strong> open Calendar, show the calendar list, click the share button beside an iCloud calendar, then select Public Calendar and copy the link.</p>
        <p className="mt-0 mb-2">Paste the webcal:// link below. Calendars stored only on your device need to be moved to iCloud first. For Google or Outlook calendars shown in Apple Calendar, use their original provider.</p>
        <a href="https://support.apple.com/guide/calendar/share-calendars-icl32362/mac" target="_blank" rel="noreferrer" className="underline underline-offset-2">Apple’s calendar sharing guide</a>
      </details>
      <p className="m-0 text-sm text-muted">Public Calendar lets anyone with the link read that calendar. Removing it from Boiler Hub stops our reads; turn off Public Calendar in Apple Calendar to revoke the link for everyone. Your Apple Account password is never needed.</p>
    </div>
  );
}

function HowTo({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group text-sm text-body">
      <summary className="bp-summary flex min-h-11 cursor-pointer items-center font-semibold text-fg">How to: {title}</summary>
      <p className="mt-0 mb-2 pl-4">{children}</p>
    </details>
  );
}

const NEW_TOKEN_URL = "https://github.com/settings/personal-access-tokens/new";
const TOKEN_DOCS_URL =
  "https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token";

/** Paste a read-only GitHub personal access token. Used on /settings/sources and in onboarding. */
export function GitHubTokenForm({ onAdded, idPrefix = "gh" }: { onAdded?: (r: AddedSource) => void; idPrefix?: string }) {
  const [token, setToken] = useState("");
  const tokenField = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const r = await sourcesCall<AddedSource>("/api/sources", "POST", { kind: "github", token: token.trim() });
      setDone(`GitHub connected. Found ${r.tasks} ${r.tasks === 1 ? "item" : "items"}.${r.warning ? ` ${r.warning}` : ""}`);
      setToken("");
      onAdded?.(r);
      tokenField.current?.focus();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <details className="rounded-[10px] border border-line px-3 text-sm text-body">
        <summary className="bp-summary flex min-h-11 cursor-pointer items-center font-semibold text-fg">Create a read-only GitHub token</summary>
        <div className="pb-3">
        <p className="mt-0 mb-2">
          Create a{" "}
          <a href={NEW_TOKEN_URL} target="_blank" rel="noreferrer" className="underline underline-offset-2">
            fine-grained personal access token
          </a>{" "}
          with <strong>read-only</strong> access. Pick the repositories to include, then under Repository permissions set these to
          Read-only:
        </p>
        <ul className="mt-0 mb-2 pl-5">
          <li>
            <strong>Issues</strong>: issues assigned to you
          </li>
          <li>
            <strong>Pull requests</strong>: review requests and your PRs
          </li>
          <li>
            <strong>Actions</strong>: failing CI on your PRs
          </li>
          <li>
            <strong>Metadata</strong>: added automatically
          </li>
        </ul>
        <p className="m-0 text-[13px] text-muted">
          A fine-grained token only sees the repositories it was granted, so review requests on other organizations&apos; repos may not
          appear (an org can also require approval for fine-grained tokens).{" "}
          <a href={TOKEN_DOCS_URL} target="_blank" rel="noreferrer" className="underline underline-offset-2">
            How tokens work
          </a>
        </p>
        </div>
      </details>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-token`} className={labelClass}>
            Personal access token
          </label>
          <input
            ref={tokenField}
            id={`${idPrefix}-token`}
            type="password"
            readOnly={busy}
            required
            autoComplete="off"
            spellCheck={false}
            placeholder="github_pat_…"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className={`${fieldClass} font-mono text-base`}
          />
        </div>
        <Button type="submit" variant="primary" disabled={!token.trim()} aria-disabled={busy || !token.trim()} aria-busy={busy}>
          {busy ? "Checking…" : "Connect GitHub"}
        </Button>
      </form>
      <p className="-mt-2 mb-0 text-xs text-muted">Stored encrypted and never shown again. Revoke it on GitHub any time.</p>
      <Feedback message={error ?? done} tone={error ? "error" : "success"} />
    </div>
  );
}
