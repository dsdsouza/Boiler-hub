import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/user";
import { listMyTeams } from "@/lib/data/teams";
import { C, DISPLAY } from "./_theme";
import { CreateTeamForm, JoinTeamForm } from "./_components/TeamForms";
import { TeamCard } from "./_components/TeamCard";

export const dynamic = "force-dynamic";

export const metadata = { title: "Teams · Boilerplate" };

export default async function TeamsPage() {
  const { supabase, user } = await getCurrentUser();
  if (!user) redirect("/?next=/teams");
  const teams = await listMyTeams(supabase, user.id);

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
