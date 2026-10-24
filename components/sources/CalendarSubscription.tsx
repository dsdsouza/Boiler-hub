"use client";

import { useEffect, useId, useRef, useState } from "react";
import { subscriptionLinks, type SubscriptionLinks } from "@/lib/calendar/links";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { sourcesCall } from "./api";

interface SubscriptionResponse { feedPath: string | null }
const ENDPOINT = "/api/calendar/subscription";

/** The outbound calendar subscription. Importing an existing iCloud feed is a separate action. */
export function CalendarSubscription() {
  const id = useId();
  const [links, setLinks] = useState<SubscriptionLinks | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void sourcesCall<SubscriptionResponse>(ENDPOINT, "GET")
      .then((response) => { if (alive && response.feedPath) setLinks(subscriptionLinks(response.feedPath, window.location.origin)); })
      .catch((e: Error) => { if (alive) setError(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  async function subscribe() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await sourcesCall<SubscriptionResponse>(ENDPOINT, "POST");
      if (!response.feedPath) throw new Error("The subscription link could not be created. Try again.");
      const next = subscriptionLinks(response.feedPath, window.location.origin);
      setLinks(next);
      setNotice("Confirm Subscribe in Apple Calendar to finish. If it did not open, use Open Apple Calendar or copy the link.");
      window.location.assign(next.webcal);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  async function copy() {
    if (!links) return;
    try {
      await navigator.clipboard.writeText(links.https);
      setError(null);
      setNotice("Subscription link copied. In Calendar, choose Add Subscription Calendar and paste it.");
    } catch { setError("Select and copy the calendar URL below, then add it as a subscription in Calendar."); }
  }

  async function disable() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      await sourcesCall(ENDPOINT, "DELETE");
      setLinks(null);
      setNotice("Subscription disabled. Remove the calendar in Apple Calendar to clear any previously downloaded deadlines.");
    } catch (e) { setError((e as Error).message); }
    finally { pending.current = false; setBusy(false); }
  }

  return (
    <Card as="section" aria-labelledby={`${id}-title`} className="px-5 py-6 sm:px-7">
      <CardTitle id={`${id}-title`} className="mb-1">Deadlines in Apple Calendar</CardTitle>
      <p className="mt-0 mb-4 text-sm text-body">Subscribe to your dated tasks and team assignments. Apple Calendar checks for updates on its refresh schedule; edit or complete deadlines in Boiler Hub. Imported calendar and GitHub items stay with their original source.</p>
      <div className="flex flex-wrap items-center gap-3">
        {links ? (
          <>
            <LinkButton href={links.webcal} plain variant="primary" aria-describedby={`${id}-privacy`}>Open Apple Calendar</LinkButton>
            <Button onClick={() => void copy()} disabled={busy}>Copy subscription link</Button>
            <Button variant="ghost" onClick={() => void disable()} disabled={busy}>{busy ? "Disabling…" : "Disable subscription"}</Button>
          </>
        ) : (
          <Button variant="primary" onClick={() => void subscribe()} disabled={loading || busy} aria-busy={loading || busy} aria-describedby={`${id}-privacy`}>
            {loading ? "Checking subscription…" : busy ? "Preparing subscription…" : "Subscribe in Apple Calendar"}
          </Button>
        )}
      </div>
      {links && <div className="mt-3 flex flex-col gap-1.5">
        <label htmlFor={`${id}-url`} className="text-[13px] font-medium text-body">Private calendar URL</label>
        <input id={`${id}-url`} type="url" readOnly value={links.https} onFocus={(e) => e.currentTarget.select()} className="min-h-11 w-full rounded-lg border border-line bg-field px-3 font-mono text-base text-fg" />
      </div>}
      <p id={`${id}-privacy`} className="mt-3 mb-0 text-xs text-muted">Anyone with this private link can read these deadlines. Disable the subscription here to stop future access.</p>
      <p role="status" className="mt-2 mb-0 text-sm text-cool-ink">{notice}</p>
      <p role="alert" className="mt-2 mb-0 text-sm text-redline-ink">{error}</p>
    </Card>
  );
}
