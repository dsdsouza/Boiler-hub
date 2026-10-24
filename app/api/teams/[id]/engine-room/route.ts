import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEngineRoom } from "@/lib/data/teams";
import { fail, getCaller, requireTeamRole, serverError } from "../../_lib/http";

// GET /api/teams/[id]/engine-room: visible boilers (team_boilers only) plus hidden count.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: teamId } = await params;
  const caller = await getCaller();
  if (!caller) return fail(401, "Sign in first");

  try {
    const check = await requireTeamRole(caller.supabase, teamId, caller.user.id, "member");
    if ("error" in check) return check.error;
    // Membership verified above; getEngineRoom re-checks before touching the admin client.
    const room = await getEngineRoom(caller.supabase, createAdminClient(), teamId, caller.user.id);
    if (!room) return fail(404, "Team not found");
    return NextResponse.json(room);
  } catch (e) {
    return serverError(e);
  }
}
