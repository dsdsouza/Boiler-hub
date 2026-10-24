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
        <p className="mt-0 mb-5 max-w-[65ch] text-base leading-relaxed text-body">Use the Calendar Finder in desktop Chrome or Edge. It checks the school page you choose for links in calendar dialogs, fields and menus.</p>
        <LinkButton plain href="/downloads/boiler-calendar-helper.zip" download variant="primary">Download Calendar Finder</LinkButton>
        <ol className="my-6 max-w-[70ch] list-decimal space-y-4 pl-5 text-[15px] leading-relaxed text-body marker:font-semibold marker:text-brass-ink">
          <li><strong className="text-fg">Install the helper.</strong> Unzip the download. In Chrome, open <code className="text-sm text-brass-ink">chrome://extensions</code>; in Edge, <code className="text-sm text-brass-ink">edge://extensions</code>. Turn on Developer mode, choose <strong>Load unpacked</strong>, and select the <strong>boiler-calendar-helper</strong> folder.</li>
          <li><strong className="text-fg">Open your school calendar.</strong> Sign in to your school as usual. Look for Subscribe, Calendar Feed or Export calendar, and leave the link dialog open.</li>
          <li><strong className="text-fg">Find and review the link.</strong> Open Calendar Finder from your browser’s extensions menu. Choose <strong>Review in Boiler Hub</strong> beside a result, then check the feed before connecting.</li>
        </ol>
        <p className="m-0 max-w-[65ch] text-sm leading-relaxed text-muted">Scanning happens in your browser when you open the helper or choose Scan this page. Passwords and hidden fields are skipped. You choose which calendar link to bring into Boiler Hub for review.</p>
      </section>
      <section aria-labelledby="helper-missing" className="border-t border-line pt-6">
        <h2 id="helper-missing" className="mt-0 mb-3 font-display text-[30px] leading-none">No link found?</h2>
        <p className="m-0 max-w-[65ch] text-sm leading-relaxed text-body">The helper offers instructions for Brightspace, Canvas, Moodle and Blackboard. Open the feed dialog and scan again. If your school has disabled feeds, ask its support team for a calendar subscription. For a calendar embedded from another website, open it in its own tab first.</p>
        <LinkButton href="/settings/sources" variant="ghost" className="mt-5">Paste a link in Sources</LinkButton>
      </section>
    </div>
  );
}
