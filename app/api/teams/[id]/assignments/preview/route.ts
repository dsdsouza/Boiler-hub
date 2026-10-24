import { NextResponse } from "next/server";
import type { AssignmentPreview } from "@/lib/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadAssignmentTargets } from "@/lib/data/teams";
import { computeTargets, parseAssignmentInput, toPreview } from "../../../_lib/assignment";
import { fail, getCaller, readJson, requireTeamRole, serverError } from "../../../_lib/http";

// POST /api/teams/[id]/assignments/preview { title, due, size } -> AssignmentPreview.
// Adds the task to each recipient's stored raw; no calendars are re-read.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: teamId } = await params;
  const caller = await getCaller();
  if (!caller) return fail(401, "Sign in first");

  const now = new Date();
  const parsed = parseAssignmentInput(await readJson(req), now);
  if (!parsed.ok) return fail(400, parsed.error);

  try {
    const check = await requireTeamRole(caller.supabase, teamId, caller.user.id, "lead");
    if ("error" in check) return check.error;

    // Verified lead: admin reads recipients' raw. Hidden members leave only as counts.
    const targets = await loadAssignmentTargets(createAdminClient(), teamId);
    const preview: AssignmentPreview = toPreview(targets, computeTargets(targets, parsed.value, now));
    return NextResponse.json(preview);
  } catch (e) {
    return serverError(e);
  }
}
