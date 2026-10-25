import type { Role } from "@/lib/types";
import type { TeamType } from "@/lib/data/teams";
import { MONO, plural, teamLabels } from "../_theme";

export function TeamMetadata({ type, role, memberCount, hiddenCount = 0, inviteCode }: {
  type: TeamType;
  role: Role;
  memberCount: number;
  hiddenCount?: number;
  inviteCode?: string;
}) {
  const labels = teamLabels(type);
  const pill = "rounded-full border border-line bg-surface-2 px-3 py-1.5 text-[13px] leading-5 text-body tabular-nums";
  return (
    <ul aria-label="Team details" className="m-0 flex list-none flex-wrap gap-2 p-0">
      <li className={pill}>{role === "lead" ? labels.lead : labels.member}</li>
      <li className={pill}>{plural(memberCount, labels.member.toLowerCase(), labels.members)}</li>
      {hiddenCount > 0 && <li className={pill}>{hiddenCount} hidden from you</li>}
      {inviteCode && <li className={pill}>Invite code <span className={`font-bold ${MONO}`}>{inviteCode}</span></li>}
    </ul>
  );
}
