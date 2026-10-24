import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { countLeads, getMembership, setMemberRole } from "@/lib/data/teams";
import type { Role, Visibility } from "@/lib/types";
import { fail, getCaller, isUuid, readJson, requireTeamRole, serverError } from "../../_lib/http";

const VISIBILITIES: Visibility[] = ["hidden", "lead", "everyone"];
const ROLES: Role[] = ["lead", "member"];

// PATCH /api/teams/[id]/membership
//   { visibility }      sets my own visibility (user client; only that column is granted)
//   { userId, role }    leads promote co-leads (or demote leads, never the last one)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: teamId } = await params;
  const caller = await getCaller();
  if (!caller) return fail(401, "Sign in first");
  const { supabase, user } = caller;

  const body = (await readJson(req)) as { visibility?: unknown; userId?: unknown; role?: unknown } | null;

  try {
    if (body && "visibility" in body) {
      const visibility = body.visibility as Visibility;
      if (!VISIBILITIES.includes(visibility)) return fail(400, "Visibility must be hidden, lead or everyone");
      const check = await requireTeamRole(supabase, teamId, user.id, "member");
      if ("error" in check) return check.error;

      const { error } = await supabase
        .from("memberships")
        .update({ visibility })
        .eq("team_id", teamId)
        .eq("user_id", user.id);
      if (error) return serverError(error);
      return NextResponse.json({ visibility });
    }

    if (body && "role" in body) {
      const role = body.role as Role;
      if (!ROLES.includes(role)) return fail(400, "Role must be lead or member");
      if (!isUuid(body.userId)) return fail(400, "userId is required");
      const check = await requireTeamRole(supabase, teamId, user.id, "lead");
      if ("error" in check) return check.error;

      // Caller is a verified lead of this team: admin client is allowed from here.
      const admin = createAdminClient();
      const target = await getMembership(admin, teamId, body.userId);
      if (!target) return fail(404, "Not a member of this team");
      if (role === "member" && target.role === "lead" && (await countLeads(admin, teamId)) <= 1) {
        return fail(409, "A team needs at least one lead");
      }
      await setMemberRole(admin, teamId, body.userId, role);
      return NextResponse.json({ userId: body.userId, role });
    }

    return fail(400, "Send { visibility } or { userId, role }");
  } catch (e) {
    return serverError(e);
  }
}
