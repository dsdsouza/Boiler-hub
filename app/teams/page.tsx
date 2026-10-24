import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listMyTeams, type MyTeam } from "@/lib/data/teams";
import { C, DISPLAY, MONO, plural, teamLabels } from "./_theme";
import { CreateTeamForm, JoinTeamForm } from "./_components/TeamForms";
import { VisibilityPicker } from "./_components/VisibilityPicker";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/?next=/teams");
  const teams = await listMyTeams(supabase, data.user.id);

  return (
    <main className="mx-auto flex max-w-[1320px] flex-col gap-6 px-4 pb-24 pt-7 sm:px-8 sm:pb-16">
      <h1 className={`m-0 text-[52px] leading-none tracking-[0.02em] sm:text-[60px] ${DISPLAY}`}>Teams</h1>

      {teams.length === 0 ? (
        <p className="m-0 rounded-xl p-5 text-[15px]" style={{ backgroundColor: C.surface, border: `1px dashed ${C.rivet}`, color: C.text2 }}>
          You are not on any team yet. Create one or join with a code from your lead or teacher.
        </p>
      ) : (
        <section aria-label="Your teams" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {teams.map((t) => (
            <TeamCard key={t.id} team={t} />
          ))}
        </section>
      )}

      <div className="flex flex-wrap gap-6">
        <CreateTeamForm />
        <JoinTeamForm />
      </div>
    </main>
  );
}

function TeamCard({ team }: { team: MyTeam }) {
  const l = teamLabels(team.type);
  return (
    <article className="flex flex-col gap-4 rounded-xl p-5" style={{ backgroundColor: C.surface, border: `1px solid ${C.line}` }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className={`text-xs tracking-[0.16em] ${MONO}`} style={{ color: C.brassLight }}>
            {team.type === "class" ? "CLASS" : "WORK TEAM"}
          </div>
          <h2 className={`m-0 truncate text-[34px] leading-none tracking-[0.02em] ${DISPLAY}`}>{team.name}</h2>
          <p className="m-0 text-sm" style={{ color: C.muted }}>
            You are {team.role === "lead" ? `the ${l.lead}` : `a ${l.member}`} ·{" "}
            {plural(team.visibleCount + team.hiddenCount, l.member.toLowerCase(), l.members)}
            {team.hiddenCount > 0 && ` · ${team.hiddenCount} hidden from you`}
          </p>
        </div>
        <Link
          href={`/teams/${team.id}`}
          className={`inline-flex min-h-11 items-center rounded-lg px-4 text-xl tracking-[0.05em] no-underline ${DISPLAY}`}
          style={{ backgroundColor: C.brass, color: C.onFill, boxShadow: "inset 0 -3px 0 #8C6A35" }}
        >
          Engine Room →
        </Link>
      </div>
      {team.inviteCode && (
        <p className="m-0 text-sm" style={{ color: C.muted }}>
          Invite code{" "}
          <span className={`font-bold tracking-[0.12em] ${MONO}`} style={{ color: C.text }}>
            {team.inviteCode}
          </span>
        </p>
      )}
      <VisibilityPicker teamId={team.id} value={team.visibility} leadLabel={l.lead} />
    </article>
  );
}
