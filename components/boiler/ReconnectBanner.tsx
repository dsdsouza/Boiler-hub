/**
 * Shown when the engine reports calendar: "reconnect" (Google tokens missing or expired).
 * The score then uses tasks only and is not shared with teams until the calendar is back.
 */
export function ReconnectBanner({ next = "/boiler", className = "" }: { next?: string; className?: string }) {
  return (
    <div
      role="alert"
      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-hot-ink bg-surface px-4 py-3 ${className}`}
    >
      <p className="m-0 text-sm text-body">
        <strong className="text-fg">Google Calendar is disconnected.</strong> Your score only counts tasks until you reconnect, and
        your teams keep seeing your last synced score.
      </p>
      {/* Route handler, not a page: plain anchor so Next does not prefetch the OAuth redirect. */}
      <a
        href={`/auth/signin?next=${encodeURIComponent(next)}`}
        className="inline-flex min-h-11 items-center rounded-lg bg-brass px-4 text-sm font-semibold text-soot no-underline hover:bg-brass-light hover:text-soot"
      >
        Reconnect Google Calendar
      </a>
    </div>
  );
}

/** Shown when the engine reports calendar: "unavailable" (a Google outage or network error, not a sign-in problem). */
export function CalendarUnavailableBanner({ className = "" }: { className?: string }) {
  return (
    <div role="status" className={`rounded-lg border border-hot-ink bg-surface px-4 py-3 ${className}`}>
      <p className="m-0 text-sm text-body">
        <strong className="text-fg">Google Calendar temporarily unavailable — showing tasks only.</strong> We will try again on the next
        refresh. Your teams keep seeing your last synced score.
      </p>
    </div>
  );
}
