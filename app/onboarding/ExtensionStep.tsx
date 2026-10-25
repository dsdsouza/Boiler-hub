"use client";

import type { ReactEventHandler } from "react";
import { Disclosure } from "@/components/ui/Disclosure";
import { Button, LinkButton } from "@/components/ui/Button";
import { FlameLoader } from "@/components/ui/FlameLoader";
import { useExtension } from "./useExtension";

export function ExtensionStep({
  extension,
  onToggle,
}: {
  extension: ReturnType<typeof useExtension>;
  onToggle?: ReactEventHandler<HTMLDetailsElement>;
}) {
  const name = "Pip";
  const showLoader = extension.state === "checking" || extension.state === "missing";
  return (
    <div className="flex flex-col gap-5">
      <p className="m-0 text-body leading-relaxed">
        Install Pip once to import school calendar links, receive laptop reminders and pause distracting sites during the study sessions you accept. Available for desktop Chrome, Brave and Edge.
      </p>
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-y border-line py-4"
        role="status"
        aria-live="polite"
      >
        <span
          className={`flex items-center gap-2.5 ${
            extension.state === "installed"
              ? "font-semibold text-cool-ink"
              : "text-muted"
          }`}
        >
          {showLoader && <FlameLoader size="sm" decorative />}
          <span key={extension.state} className={showLoader ? "bp-pip-thought" : undefined}>
            {extension.state === "installed"
              ? `${name} is installed · v${extension.version}`
              : extension.state === "outdated"
                ? `Pip v${extension.version} needs an update. Download and reload the current version.`
                : extension.state === "checking"
                  ? "Checking this browser…"
                  : "Extension not detected in this browser"}
          </span>
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
            href="/downloads/boilerplate-focus-extension.zip"
            download
            variant="secondary"
            className="self-start"
          >
            Download {name}
          </LinkButton>
          <Disclosure label="Installation steps" onToggle={onToggle}>
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
          </Disclosure>
        </>
      )}
      {extension.state === "installed" && (
        <p className="m-0 text-sm text-body">Open your school calendar, choose Pip at the top right, then Find calendar links on this page. Choose Use in onboarding beside the link you want to review.</p>
      )}
    </div>
  );
}
