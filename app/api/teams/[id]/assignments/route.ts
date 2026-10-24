import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAssignment, loadAssignmentTargets } from "@/lib/data/teams";
import { computeTargets, parseAssignmentInput, toPreview } from "../../_lib/assignment";
import { fail, getCaller, readJson, requireTeamRole, serverError } from "../../_lib/http";
import { syncUser } from "../../_lib/pressure";

// POST /api/teams/[id]/assignments { title, due, size }
// Creates the assignment, one `team` task per non-lead member (hidden ones included),
// updates their snapshots with the preview math, then triggers each member's resync.
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

    // Best effort: a failed resync must not undo a posted assignment.
    const syncs = await Promise.allSettled(targets.map((t) => syncUser(admin, t.userId, now)));
    syncs.forEach((s) => s.status === "rejected" && console.error("[assignments] resync failed", s.reason));

    return NextResponse.json(
      { assignmentId, recipients: targets.length, result: toPreview(targets, results) },
      { status: 201 },
    );
  } catch (e) {
    return serverError(e);
  }
}
