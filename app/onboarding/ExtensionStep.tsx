"use client";

import { Button, LinkButton } from "@/components/ui/Button";
import { useExtension } from "./useExtension";

export function ExtensionStep({
  extension,
}: {
  extension: ReturnType<typeof useExtension>;
}) {
  const name = "Pip";
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
          className={
            extension.state === "installed"
              ? "font-semibold text-cool-ink"
              : "text-muted"
          }
        >
          {extension.state === "installed"
            ? `${name} is installed · v${extension.version}`
            : extension.state === "outdated"
              ? `Pip v${extension.version} needs an update. Download and reload the current version.`
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
            href="/downloads/boilerplate-focus-extension.zip"
            download
            variant="secondary"
            className="self-start"
          >
            Download {name}
          </LinkButton>
          <details className="border-t border-line pt-4 text-sm text-body">
            <summary className="cursor-pointer font-semibold text-brass-ink">Installation steps</summary>
            <ol className="mt-4 mb-0 list-decimal space-y-3 pl-5 leading-relaxed">
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
          </details>
        </>
      )}
      {extension.state === "installed" && (
        <p className="m-0 text-sm text-body">Open your school calendar, choose Pip at the top right, then Find calendar links on this page. Choose Use in onboarding beside the link you want to review.</p>
      )}
    </div>
  );
}
