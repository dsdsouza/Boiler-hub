import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAssignment, loadAssignmentTargets } from "@/lib/data/teams";
import { computeTargets, parseAssignmentInput, toPreview } from "../../_lib/assignment";
import { fail, getCaller, readJson, requireTeamRole, serverError } from "../../_lib/http";

// POST /api/teams/[id]/assignments { title, due, size }
// Creates the assignment, one `team` task per non-lead member (hidden ones included), and
// updates their snapshots with the preview math (applyTaskToRaw). No calendar or source is
// fetched, so posting stays fast and the result matches the preview exactly; each member's
// own next sync reconciles.
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

    // Verified lead: admin client allowed for fan-out and snapshot updates.
    const admin = createAdminClient();
    const targets = await loadAssignmentTargets(admin, teamId);
    const results = computeTargets(targets, parsed.value, now);
    const { assignmentId } = await createAssignment(
      admin,
      teamId,
      caller.user.id,
      parsed.value,
      targets,
      results,
      now,
    );

    return NextResponse.json(
      { assignmentId, recipients: targets.length, result: toPreview(targets, results) },
      { status: 201 },
    );
  } catch (e) {
    return serverError(e);
  }
}
