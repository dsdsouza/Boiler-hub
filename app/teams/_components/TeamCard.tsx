import Link from "next/link";
import type { MyTeam } from "@/lib/data/teams";
import { C, DISPLAY, teamLabels } from "../_theme";
import { TeamMetadata } from "./TeamMetadata";
import { VisibilityPicker } from "./VisibilityPicker";

export function TeamCard({ team }: { team: MyTeam }) {
  const labels = teamLabels(team.type);
  return (
    <article className="flex flex-col gap-4 rounded-xl p-5" style={{ backgroundColor: C.surface, border: `1px solid ${C.line}` }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className={`m-0 min-w-0 truncate text-[34px] leading-none tracking-[0.02em] ${DISPLAY}`}>{team.name}</h2>
        <Link
          href={`/teams/${team.id}`}
          prefetch={true}
          className={`inline-flex min-h-11 items-center rounded-lg px-4 text-xl tracking-[0.05em] no-underline ${DISPLAY}`}
          style={{ backgroundColor: C.brass, color: C.onFill, boxShadow: "inset 0 -3px 0 #8C6A35" }}
        >
          Engine Room →
        </Link>
      </div>
      <TeamMetadata type={team.type} role={team.role} memberCount={team.visibleCount + team.hiddenCount} hiddenCount={team.hiddenCount} inviteCode={team.inviteCode} />
      <VisibilityPicker teamId={team.id} value={team.visibility} leadLabel={labels.lead} />
    </article>
  );
}
