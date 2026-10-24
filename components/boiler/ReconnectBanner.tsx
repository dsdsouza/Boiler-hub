/**
 * Shown when the engine reports calendar: "reconnect" (Google tokens missing or expired).
 * The score then uses tasks and connected sources; teams retain the previous snapshot.
 */
export function ReconnectBanner({ next = "/boiler", className = "" }: { next?: string; className?: string }) {
  return (
    <div
      role="alert"
      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-hot-ink bg-surface px-4 py-3 ${className}`}
    >
      <p className="m-0 text-sm text-body">
        <strong className="text-fg">Google Calendar is disconnected.</strong> Tasks and connected sources still count.
        Your teams keep seeing your last synced score until you reconnect.
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
        <strong className="text-fg">Google Calendar is temporarily unavailable.</strong> Tasks and connected sources still count.
        We will try again on the next refresh. Your teams keep seeing your last synced score.
      </p>
    </div>
  );
}
