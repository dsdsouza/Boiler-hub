"use client";

import { useEffect } from "react";
import { Button, LinkButton } from "@/components/ui/Button";
import { useExtension } from "./useExtension";

export function ExtensionStep({
  kind,
  onVerified,
}: {
  kind: "calendar" | "focus";
  onVerified: (installed: boolean) => void;
}) {
  const extension = useExtension(kind);
  useEffect(
    () => onVerified(extension.state === "installed"),
    [extension.state, onVerified],
  );
  const name = kind === "calendar" ? "Calendar Finder" : "Focus with Pip";
  return (
    <div className="flex flex-col gap-5">
      <p className="m-0 text-body leading-relaxed">
        {kind === "calendar"
          ? "Find the subscription link on your school’s calendar page, then review it before connecting. Available for desktop Chrome and Edge."
          : "Pause distracting websites during the focus sessions you choose with Pip. Available for desktop Chrome and Edge."}
      </p>
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-y border-line py-4"
        role="status"
        aria-live="polite"
      >
        <span
          className={
            extension.state === "installed"
              ? "font-semibold text-cool-ink"
              : "text-muted"
          }
        >
          {extension.state === "installed"
            ? `${name} is installed · v${extension.version}`
            : extension.state === "checking"
              ? "Checking this browser…"
              : "Extension not detected in this browser"}
        </span>
        <Button
          onClick={() => extension.check()}
          disabled={extension.state === "checking"}
        >
          {extension.state === "checking" ? "Checking…" : "Check again"}
        </Button>
      </div>
      {extension.state !== "installed" && (
        <>
          <LinkButton
            plain
            href={
              kind === "calendar"
                ? "/downloads/boiler-calendar-helper.zip"
                : "/downloads/boilerplate-focus-extension.zip"
            }
            download
            variant="secondary"
            className="self-start"
          >
            Download {name}
          </LinkButton>
          <ol className="m-0 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-body">
            <li>Unzip the download.</li>
            <li>
              Open <code className="text-brass-ink">chrome://extensions</code>{" "}
              or <code className="text-brass-ink">edge://extensions</code> and
              turn on <strong>Developer mode</strong>.
            </li>
            <li>
              Choose <strong>Load unpacked</strong> and select the unzipped
              extension folder.
            </li>
            <li>
              Come back and choose <strong>Check again</strong>. If you just
              installed it, refresh this page first. Your answers are saved.
            </li>
          </ol>
        </>
      )}
      <p className="m-0 text-sm leading-relaxed text-muted">
        {kind === "calendar"
          ? "The extension only scans a school page when you ask. Passwords and hidden fields are skipped. A download alone does not confirm installation."
          : "Only your chosen focus sessions turn blocking on. Ending a session restores access to those sites."}
      </p>
      {extension.state === "installed" && kind === "calendar" && (
        <p className="m-0 text-sm text-body">
          Next time you open a school calendar, choose{" "}
          <strong>Scan this page</strong> from Calendar Finder. You can connect
          a feed in the next step.
        </p>
      )}
    </div>
  );
}
