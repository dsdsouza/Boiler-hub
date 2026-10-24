import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAssignment, loadAssignmentTargets } from "@/lib/data/teams";
import { computeTargets, parseAssignmentInput, toPreview } from "../../_lib/assignment";
import { fail, getCaller, readJson, requireTeamRole, serverError } from "../../_lib/http";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/teams/[id]/assignments { title, due, size, clientKey? }
// clientKey: a UUID per draft. Posting the same draft again returns the first assignment
// ({ duplicate: true, result: null }) instead of creating a second one.
// Creates the assignment, one `team` task per non-lead member (hidden ones included), and
// updates their snapshots with the preview math (applyTaskToRaw). No calendar or source is
// fetched, so posting stays fast and the result matches the preview exactly; each member's
// own next sync reconciles.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: teamId } = await params;
  const caller = await getCaller();
  if (!caller) return fail(401, "Sign in first");

  const now = new Date();
  const body = await readJson(req);
  const parsed = parseAssignmentInput(body, now);
  if (!parsed.ok) return fail(400, parsed.error);
  const clientKey = (body as { clientKey?: unknown } | null)?.clientKey;
  if (clientKey !== undefined && (typeof clientKey !== "string" || !UUID_RE.test(clientKey))) {
    return fail(400, "clientKey must be a UUID");
  }

  try {
    const check = await requireTeamRole(caller.supabase, teamId, caller.user.id, "lead");
    if ("error" in check) return check.error;

    // Verified lead: admin client allowed for fan-out and snapshot updates.
    const admin = createAdminClient();
    const targets = await loadAssignmentTargets(admin, teamId);
    const results = computeTargets(targets, parsed.value, now);
    const posted = await createAssignment(
      admin,
      teamId,
      caller.user.id,
      parsed.value,
      targets,
      results,
      now,
      clientKey,
    );
    const { assignmentId, duplicate } = posted;
    if (duplicate) return NextResponse.json({ assignmentId, duplicate: true, result: null });

    return NextResponse.json(
      { assignmentId, duplicate: false, result: toPreview(posted.targets, posted.results) },
      { status: 201 },
    );
  } catch (e) {
    return serverError(e);
  }
}
