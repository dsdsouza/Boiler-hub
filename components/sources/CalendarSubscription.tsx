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
  const [confirmation, setConfirmation] = useState<"subscribe" | "disable" | null>(null);
  const subscribeButton = useRef<HTMLButtonElement>(null);
  const disableButton = useRef<HTMLButtonElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const openCalendar = useRef<HTMLAnchorElement>(null);
  const returnFocus = useRef(false);
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

  useEffect(() => {
    if (confirmation) cancelButton.current?.focus();
    else if (returnFocus.current) {
      (links ? openCalendar.current : subscribeButton.current)?.focus();
      returnFocus.current = false;
    }
  }, [confirmation, links]);

  function cancel() {
    if (pending.current) return;
    const trigger = confirmation === "subscribe" ? subscribeButton : disableButton;
    setConfirmation(null);
    trigger.current?.focus();
  }

  function ask(action: "subscribe" | "disable") {
    if (pending.current) return;
    setError(null);
    setNotice(null);
    setConfirmation(action);
  }

  async function subscribe() {
    if (pending.current || confirmation !== "subscribe") return;
    pending.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await sourcesCall<SubscriptionResponse>(ENDPOINT, "POST");
      if (!response.feedPath) throw new Error("The subscription link could not be created. Try again.");
      const next = subscriptionLinks(response.feedPath, window.location.origin);
      returnFocus.current = true;
      setLinks(next);
      setConfirmation(null);
      setNotice("Confirm Subscribe in Apple Calendar to finish. If it did not open, use Open Apple Calendar or copy the link.");
      window.location.assign(next.webcal);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  async function disable() {
    if (pending.current || confirmation !== "disable") return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      await sourcesCall(ENDPOINT, "DELETE");
      returnFocus.current = true;
      setLinks(null);
      setConfirmation(null);
      setNotice("Subscription disabled. Remove the calendar in Apple Calendar to clear any previously downloaded deadlines.");
    } catch (e) { setError((e as Error).message); }
    finally { pending.current = false; setBusy(false); }
  }

  return (
    <Card as="section" aria-labelledby={`${id}-title`} className="px-5 py-6 sm:px-7">
      <CardTitle id={`${id}-title`} className="mb-1">Deadlines in Apple Calendar</CardTitle>
      <p className="mt-0 mb-4 max-w-[70ch] text-sm text-body">Subscribe to your dated tasks and team assignments. Apple Calendar checks for updates on its refresh schedule; edit or complete deadlines in Boilerplate. Imported calendar and GitHub items stay with their original source.</p>
      <div className="flex flex-wrap items-center gap-3">
        {links ? (
          <>
            <LinkButton ref={openCalendar} href={links.webcal} plain variant="primary">Open Apple Calendar</LinkButton>
            <Button ref={disableButton} variant="ghost" onClick={() => ask("disable")} disabled={busy} aria-expanded={confirmation === "disable"} aria-controls={confirmation === "disable" ? `${id}-confirmation` : undefined}>{busy ? "Disabling…" : "Disable subscription"}</Button>
          </>
        ) : (
          <Button ref={subscribeButton} variant="primary" onClick={() => ask("subscribe")} disabled={loading || busy} aria-busy={loading || busy} aria-expanded={confirmation === "subscribe"} aria-controls={confirmation === "subscribe" ? `${id}-confirmation` : undefined}>
            {loading ? "Checking subscription…" : busy ? "Preparing subscription…" : "Subscribe in Apple Calendar"}
          </Button>
        )}
      </div>
      {links && <div className="mt-3 flex flex-col gap-1.5">
        <label htmlFor={`${id}-url`} className="text-[13px] font-medium text-body">Private calendar URL</label>
        <input id={`${id}-url`} type="url" readOnly value={links.https} onFocus={(e) => e.currentTarget.select()} className="bp-field min-h-11 w-full rounded-lg border border-line bg-field px-3 font-mono text-base text-fg" />
      </div>}
      {confirmation && <div
        id={`${id}-confirmation`}
        role="group"
        aria-labelledby={`${id}-confirmation-title`}
        aria-describedby={`${id}-confirmation-description`}
        onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); cancel(); } }}
        className="mt-4 rounded-xl border border-line bg-bg p-4"
      >
        <h3 id={`${id}-confirmation-title`} className="mt-0 mb-2 text-base font-semibold text-fg">
          {confirmation === "subscribe" ? "Subscribe to your deadlines?" : "Disable this subscription?"}
        </h3>
        <p id={`${id}-confirmation-description`} className="mt-0 mb-4 max-w-[65ch] text-sm leading-relaxed text-body">
          {confirmation === "subscribe"
            ? "Anyone with this private link can read these deadlines. Disable the subscription here to stop future access."
            : "This link will stop working, and Apple Calendar will stop receiving updates. Previously downloaded deadlines may remain in Apple Calendar."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={confirmation === "subscribe" ? "primary" : "secondary"}
            onClick={() => void (confirmation === "subscribe" ? subscribe() : disable())}
            disabled={busy}
            aria-busy={busy}
            className={confirmation === "disable" ? "border-redline-ink text-redline-ink" : undefined}
          >
            {confirmation === "subscribe" ? (busy ? "Preparing subscription…" : "Confirm subscription") : (busy ? "Disabling…" : "Confirm disabling")}
          </Button>
          <Button ref={cancelButton} variant="ghost" onClick={cancel} disabled={busy}>Cancel</Button>
        </div>
      </div>}
      <p role="status" className="mt-2 mb-0 text-sm text-cool-ink">{notice}</p>
      <p role="alert" className="mt-2 mb-0 text-sm text-redline-ink">{error}</p>
    </Card>
  );
}
