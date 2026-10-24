"use client";

import { Button, LinkButton } from "@/components/ui/Button";
import type { StudyAccountability } from "@/components/boiler/useStudyAccountability";

export function PipConnection({ study }: { study: StudyAccountability }) {
  const paired = study.blocker.connected && study.blocker.remindersSupported;
  return <div className="flex flex-col gap-2 border-b border-line pb-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p role="status" className={`m-0 text-sm ${paired ? "text-cool-ink" : "text-muted"}`}>{paired ? study.blocker.remindersEnabled ? "Pip extension paired · laptop reminders on" : "Pip extension paired · reminders off" : study.blocker.connected ? "Update the Pip extension to pair laptop reminders" : "Pair Pip with your laptop"}</p>
      <div className="flex flex-wrap gap-2">
        {!paired && <LinkButton plain href="/downloads/boilerplate-focus-extension.zip" download>{study.blocker.connected ? "Download extension update" : "Download Pip extension"}</LinkButton>}
        {paired && <Button variant="ghost" onClick={() => study.enableReminders(!study.blocker.remindersEnabled)}>{study.blocker.remindersEnabled ? "Turn reminders off" : "Enable laptop reminders"}</Button>}
        {paired && study.blocker.remindersEnabled && <Button variant="ghost" onClick={study.testReminder}>Send test reminder</Button>}
      </div>
    </div>
    {!paired && <p className="m-0 text-xs leading-relaxed text-muted">Unzip the download, open Chrome’s Extensions page, turn on Developer mode and load the folder. If already installed, replace its files and reload the extension. Reload Boilerplate to pair.</p>}
    {paired && <p className="m-0 text-xs leading-relaxed text-muted">Pip can remind you and pause distracting websites for accepted plans even when this tab is closed. Keep Chrome running and allow its notifications in your laptop settings.</p>}
    {(study.blocker.reminderError || study.blocker.error) && <p role="alert" className="m-0 text-xs text-hot-ink">{study.blocker.reminderError || study.blocker.error}</p>}
  </div>;
}
