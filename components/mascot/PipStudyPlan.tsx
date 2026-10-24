"use client";

import { useState } from "react";
import { Button, LinkButton } from "@/components/ui/Button";
import type { StudyProposal } from "@/lib/pip/planning";

export function PipStudyPlan({ proposal, ready, replacing, onAccept, onDismiss }: { proposal: StudyProposal; ready: boolean; replacing: boolean; onAccept?: (proposal: StudyProposal) => void; onDismiss: () => void }) {
  const [confirmedFree, setConfirmedFree] = useState(!proposal.tentative);
  const [confirmedReplace, setConfirmedReplace] = useState(false);
  const format = (value: number) => new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" }).format(value);
  return <div className="grid gap-3 border-t border-line pt-4" aria-label="Pip's proposed study commitment">
    <div><p className="m-0 text-sm font-semibold text-fg">Your next small step</p><p className="mt-1 mb-0 text-sm text-body">{proposal.title}</p><p className="mt-1 mb-0 text-sm text-body">{proposal.goal}</p><p className="mt-2 mb-0 font-mono text-xs text-brass-ink">{format(proposal.startAt)} – {format(proposal.endAt)} · {Math.round((proposal.endAt - proposal.startAt) / 60000)} min</p></div>
    {proposal.tentative && <label className="flex min-h-11 items-start gap-2 text-sm text-body"><input type="checkbox" checked={confirmedFree} onChange={(e) => setConfirmedFree(e.target.checked)} className="mt-1 h-4 w-4 accent-brass" /><span>My calendar is incomplete. I confirm this time works for me.</span></label>}
    {replacing && <label className="flex min-h-11 items-center gap-2 text-sm text-body"><input type="checkbox" checked={confirmedReplace} onChange={(e) => setConfirmedReplace(e.target.checked)} className="h-4 w-4 accent-brass" />Replace my current focus commitment</label>}
    <p className="m-0 text-xs leading-relaxed text-muted">Accepting pairs this commitment with the Pip extension: laptop reminders, five distracting websites paused during the block, and a check-in afterward. You can release it any time.</p>
    <div className="flex flex-wrap gap-2">{onAccept ? <Button disabled={!ready || !confirmedFree || (replacing && !confirmedReplace)} onClick={() => onAccept(proposal)}>Accept plan & keep me accountable</Button> : <LinkButton href="/boiler">Review plan in My Boiler</LinkButton>}<Button variant="ghost" onClick={onDismiss}>Dismiss plan</Button></div>
    {onAccept && !ready && <p className="m-0 text-xs text-muted">Pair or update the extension and enable laptop reminders above to accept this plan.</p>}
  </div>;
}
