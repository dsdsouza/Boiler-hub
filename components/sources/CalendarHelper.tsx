"use client";

import { useEffect, useRef, useState } from "react";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Feedback } from "@/components/ui/Feedback";
import { readHandoff } from "@/browser-helper/protocol.js";
import { forgetHelperFeed, readHelperFeed, rememberHelperFeed } from "@/lib/sources/helper-handoff";
import { CalendarFeedForm } from "./SourceForms";
import { foundLine } from "./api";

const SIGN_IN = "/auth/signin?next=%2Fcalendar-helper";

export function CalendarHelper({ signedIn }: { signedIn: boolean }) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [retained, setRetained] = useState(false);
  const [importing, setImporting] = useState(false);
  const focusSetup = useRef(false);
  useEffect(() => {
    const receive = () => {
      const hash = window.location.hash;
      const incoming = readHandoff(hash);
      if (hash) window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
      setSuccess(null); setRetained(false);
      // Storage access itself can throw when the browser blocks site data.
      try {
        if (hash) {
          forgetHelperFeed(window.sessionStorage);
          if (incoming) rememberHelperFeed(window.sessionStorage, incoming);
        }
        const cached = readHelperFeed(window.sessionStorage);
        const chosen = incoming || (!hash ? cached : null);
        setPending(chosen); setRetained(!!chosen && cached === chosen);
      } catch { setPending(incoming); }
      setError(hash && !incoming ? "That link could not be used. Scan the school calendar again, or paste its subscription link in Sources." : null);
      setReady(true);
    };
    receive();
    window.addEventListener("hashchange", receive);
    return () => window.removeEventListener("hashchange", receive);
  }, []);

  useEffect(() => {
    if (!pending && focusSetup.current) {
      focusSetup.current = false;
      document.getElementById("helper-setup")?.focus();
    }
  }, [pending]);

  useEffect(() => {
    if (success) document.getElementById("helper-done")?.focus();
  }, [success]);

  const clear = () => {
    try { forgetHelperFeed(window.sessionStorage); } catch { /* Nothing to retain. */ }
    setPending(null); setRetained(false);
  };

  return (
    <div className="flex flex-col gap-6">
      <Feedback message={error} tone="error" />
      {!ready && <p role="status" className="m-0 text-muted">Checking for a calendar link…</p>}
      {success && <Card as="section" aria-labelledby="helper-done" className="px-5 py-6 sm:px-7">
        <CardTitle id="helper-done" tabIndex={-1}>Calendar connected</CardTitle>
        <div className="my-4"><Feedback message={success} /></div>
        <LinkButton href="/boiler" variant="primary">Open My Boiler</LinkButton>
      </Card>}
      {pending && <Card as="section" aria-labelledby="helper-review" className="px-5 py-6 sm:px-7">
        <CardTitle id="helper-review">Review your calendar link</CardTitle>
        <p className="mt-2 mb-5 max-w-[65ch] text-sm leading-relaxed text-body">Found on <strong className="wrap-anywhere">{new URL(pending).hostname}</strong>. Connecting saves this private link encrypted so Boiler Hub can read it when you refresh.</p>
        {signedIn ? <CalendarFeedForm key={pending} initialUrl={pending} idPrefix="helper" onBusyChange={setImporting} onAdded={(r) => {
          clear(); setSuccess(`${r.source.label} connected. ${foundLine(r)}.${r.warning ? ` ${r.warning}` : ""}`);
        }} /> : <div className="flex flex-col items-start gap-3">
          <p className="m-0 max-w-[65ch] text-sm leading-relaxed text-body">{retained ? "Sign in to review and connect it. This tab keeps the link for up to 10 minutes while you sign in." : "This browser cannot keep the link during sign-in. Sign in, then run Calendar Finder again to bring the link back."}</p>
          <LinkButton plain href={SIGN_IN} variant="primary">Sign in with Google</LinkButton>
        </div>}
        <Button variant="ghost" className="mt-5" disabled={importing} onClick={() => { focusSetup.current = true; clear(); }}>Discard this link</Button>
      </Card>}
      <section aria-labelledby="helper-setup" className="border-t border-line pt-6">
        <h2 id="helper-setup" tabIndex={-1} className="mt-0 mb-3 font-display text-[30px] leading-none">Find a link in your browser</h2>
        <p className="mt-0 mb-5 max-w-[65ch] text-base leading-relaxed text-body">You can connect your calendar without installing anything. Copy the subscription link from your school’s calendar, then paste it into Sources.</p>
        <LinkButton href="/settings/sources" variant="primary">Open Sources</LinkButton>
        <div className="mt-6 flex flex-col border-y border-line">
          {[
            ["Brightspace (D2L)", "Open Calendar → Settings and enable Calendar Feeds. Choose Subscribe → All Calendars and Tasks, then copy the subscription link."],
            ["Canvas", "Open Calendar, choose Calendar Feed in the sidebar, then copy the feed URL."],
            ["Moodle", "Open Calendar → Export calendar. Select your courses and a range covering the term, then choose Get calendar URL and copy it."],
            ["Blackboard", "Open Calendar and its settings. Choose Share calendar (Ultra) or Get External Calendar Link (Original), then copy the iCalendar link."],
          ].map(([name, instructions]) => <details key={name} className="border-b border-line last:border-0">
            <summary className="bp-summary flex min-h-11 cursor-pointer items-center py-2 text-sm font-semibold text-fg">{name}</summary>
            <p className="mt-0 mb-4 max-w-[65ch] pl-4 text-sm leading-relaxed text-body">{instructions}</p>
          </details>)}
        </div>
      </section>
      <section aria-labelledby="helper-extension" className="border-t border-line pt-6">
        <h2 id="helper-extension" className="mt-0 mb-3 font-display text-[30px] leading-none">Automatic link finder · optional</h2>
        <p className="mt-0 mb-3 max-w-[65ch] text-sm leading-relaxed text-body">The Calendar Finder extension can look for subscription links on the school page you choose. It is a developer preview for desktop Chrome and Edge.</p>
        <details>
          <summary className="bp-summary flex min-h-11 cursor-pointer items-center text-sm font-semibold text-brass-ink">Extension preview and setup</summary>
          <div className="pt-2">
            <p className="mt-0 mb-4 max-w-[65ch] text-sm leading-relaxed text-muted">The scanner and import flow have been tested with sample school pages. Installation and live school accounts still need verification.</p>
            <LinkButton plain href="/downloads/boiler-calendar-helper.zip" download variant="secondary">Download optional extension</LinkButton>
            <ol className="my-5 max-w-[70ch] list-decimal space-y-3 pl-5 text-sm leading-relaxed text-body">
              <li>Unzip the download. Open <code>chrome://extensions</code> or <code>edge://extensions</code>, turn on Developer mode, and choose <strong>Load unpacked</strong>. Select the <strong>boiler-calendar-helper</strong> folder.</li>
              <li>Open your school calendar’s Subscribe, Calendar Feed or Export dialog, then open Calendar Finder from the extensions menu.</li>
              <li>Choose <strong>Review in Boiler Hub</strong> beside a result and check the link before connecting it. You can also copy the link into Sources.</li>
            </ol>
            <p className="m-0 max-w-[65ch] text-sm leading-relaxed text-muted">Scanning happens in your browser when you open the extension or choose Scan this page. Passwords and hidden fields are skipped. You choose which link to bring into Boiler Hub.</p>
          </div>
        </details>
      </section>
      <section aria-labelledby="helper-missing" className="border-t border-line pt-6">
        <h2 id="helper-missing" className="mt-0 mb-3 font-display text-[30px] leading-none">Can’t find your calendar link?</h2>
        <p className="m-0 max-w-[65ch] text-sm leading-relaxed text-body">Look for Subscribe, Calendar Feed or Export in your school calendar. If your school has disabled feeds, ask its support team whether calendar subscriptions are available.</p>
        <LinkButton href="/settings/sources" variant="ghost" className="mt-5">Paste a link in Sources</LinkButton>
      </section>
    </div>
  );
}
