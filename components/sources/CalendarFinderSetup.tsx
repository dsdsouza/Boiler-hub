import { Disclosure } from "@/components/ui/Disclosure";
import { LinkButton } from "@/components/ui/Button";

/** The browser helper's entry point, shared with the onboarding flow. */
export function CalendarFinderSetup() {
  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 max-w-[65ch] text-base leading-relaxed text-body">
        Use Calendar Finder to look for subscription links on your school’s calendar page, then review the link before connecting it
      </p>
      <p className="m-0 text-sm text-muted">A browser extension for desktop Chrome and Edge, available as a developer preview</p>
      <div className="flex flex-wrap gap-3">
        <LinkButton plain href="/downloads/boiler-calendar-helper.zip" download variant="primary" className="max-sm:w-full">
          Download Calendar Finder
        </LinkButton>
        <LinkButton href="/calendar-helper" variant="ghost" className="max-sm:w-full">
          Find a link manually
        </LinkButton>
      </div>
      <Disclosure label="Set up Calendar Finder">
        <ol className="m-0 max-w-[65ch] list-decimal space-y-3 pl-5 text-sm leading-relaxed text-body">
          <li>Unzip the download to get the <strong>boiler-calendar-helper</strong> folder</li>
          <li>
            Open <code>chrome://extensions</code> or <code>edge://extensions</code>, turn on Developer mode, choose <strong>Load unpacked</strong>, and select that folder
          </li>
          <li>
            Open your school calendar’s Subscribe, Calendar Feed or Export dialog, then open Calendar Finder from your browser’s extensions menu
          </li>
          <li>Choose <strong>Review in Boilerplate</strong> beside a result and check the link before connecting it</li>
        </ol>
      </Disclosure>
    </div>
  );
}
