import Link from "next/link";
import type { SourceInfo } from "@/lib/pressure/api-types";

/** Shown on My Boiler when a connected source failed its last sync. Its items are left out until it recovers. */
export function SourcesBanner({ sources, className = "" }: { sources: SourceInfo[]; className?: string }) {
  const failing = sources.filter((s) => s.status === "error");
  if (failing.length === 0) return null;
  const names = failing.map((s) => s.label).join(", ");
  return (
    <div role="alert" className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-hot-ink bg-surface px-4 py-3 ${className}`}>
      <p className="m-0 text-sm text-body">
        <strong className="text-fg">
          {failing.length === 1 ? `${names} did not sync.` : `${failing.length} sources did not sync: ${names}.`}
        </strong>{" "}
        {failing.length === 1 && failing[0]!.error ? `${failing[0]!.error}. ` : ""}
        {failing.length === 1 ? "Its items are left out of your score until it is fixed." : "Their items are left out of your score until they are fixed."}
      </p>
      <Link
        href="/settings/sources"
        className="inline-flex min-h-11 items-center rounded-lg border border-rivet bg-surface-2 px-4 text-sm font-semibold text-fg no-underline hover:border-brass hover:text-fg"
      >
        Check sources
      </Link>
    </div>
  );
}
