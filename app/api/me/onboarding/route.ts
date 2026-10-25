import { NextResponse } from "next/server";
import { badRequest, readJson, requireUser, serverError, syncSelf } from "../_lib/http";
import { supportsSetup, courseworkSources } from "@/app/onboarding/setup";
import { verifyReview } from "./verification";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isStepValid,
  needsManualTask,
  parseDraft,
  resolvedGoal,
  stepsFor,
} from "@/app/onboarding/model";

async function caller() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  return requireUser();
}

export async function GET() {
  const auth = await caller();
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json(
    {
      userId: auth.user.id,
      draft: auth.user.user_metadata?.onboarding ?? null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Owner-only metadata avoids a database migration and never stores source URLs or tokens. */
export async function PATCH(request: Request) {
  const auth = await caller();
  if (auth instanceof NextResponse) return auth;
  const body = await readJson(request);
  if (!body || !body.draft || typeof body.draft !== "object")
    return badRequest("Expected onboarding answers");
  if ((body.autosave === true || body.expectedUserId !== undefined) && body.expectedUserId !== auth.user.id)
    return NextResponse.json({ error: "Your account changed. Reload onboarding before saving more answers." }, { status: 409 });
  if (body.autosave === true && (body.draft as Record<string, unknown>).finished === true)
    return badRequest("Use Finish setup to complete onboarding.");
  const draft = parseDraft(body.draft);
  if ((body.draft as Record<string, unknown>).finished === true && !draft.finished)
    return badRequest("Setup has changed. Refresh and verify Pip and your coursework before finishing.");
  const deadlineAt =
    typeof body.deadlineAt === "string" ? body.deadlineAt : null;
  if (
    draft.finished &&
    draft.deadline &&
    (!deadlineAt ||
      Number.isNaN(Date.parse(deadlineAt)) ||
      Math.abs(
        Date.parse(deadlineAt) - Date.parse(`${draft.deadline}T12:00:00Z`),
      ) >
        36 * 3600000)
  )
    return badRequest("Choose a valid target date");
  draft.ownerId = auth.user.id;
  if (
    draft.finished &&
    stepsFor(draft).some(
      (step) =>
        !draft.completed.includes(step) || !isStepValid(step, draft, true),
    )
  )
    return badRequest("Complete the required questions first");
  // Save real profile changes before marking the journey complete; a retry is idempotent.
  let setup = undefined;
  if (draft.finished) {
    const manualStart = needsManualTask(draft);
    const extensionVersion = typeof body.extensionVersion === "string" && supportsSetup(body.extensionVersion) ? body.extensionVersion : null;
    if (!extensionVersion && !draft.extensionDeferred && draft.role !== "lead")
      return badRequest("Connect the current Pip extension in this browser before finishing setup.");
    if (extensionVersion) draft.extensionDeferred = false;
    setup = { version: 2, extensionVersion, extensionDeferred: !extensionVersion && draft.extensionDeferred, courseworkDeferred: draft.role === "student" && draft.courseworkDeferred, checkedAt: new Date().toISOString(), sourceIds: [] as string[], deadlinesReviewedAt: null as string | null };
    if (draft.role === "student" && !draft.courseworkDeferred) {
      try {
        const boiler = await syncSelf(auth.user, { freshSources: true, persist: "ifStale" });
        if (body.deadlinesReviewed !== true || !verifyReview(body.reviewReceipt, auth.user.id, boiler))
          return badRequest("Connect your coursework and review its current deadlines before finishing. If the feed changed, review it again.");
        setup.sourceIds = courseworkSources(boiler).map((s) => s.id);
        setup.deadlinesReviewedAt = setup.checkedAt;
      } catch (error) { return serverError("onboarding verification", error); }
    }
    if ((resolvedGoal(draft) === "deadlines" || manualStart) && draft.milestone.trim()) {
      // Stable owner-scoped UUID makes retries safe, including a lost response.
      const hash = new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(`${auth.user.id}:onboarding:first-task`),
        ),
      );
      hash[6] = (hash[6] & 0x0f) | 0x50;
      hash[8] = (hash[8] & 0x3f) | 0x80;
      const hex = Array.from(hash.slice(0, 16), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
      const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
      const { error: taskError } = await auth.supabase
        .from("tasks")
        .upsert(
          {
            id,
            owner_id: auth.user.id,
            title: draft.milestone.trim(),
            due_at: draft.deadline ? deadlineAt : null,
            size: "M",
            source: "manual",
          },
          { onConflict: "id", ignoreDuplicates: false },
        );
      if (taskError) return serverError("onboarding first task", taskError);
    }
    const { error } = await auth.supabase
      .from("profiles")
      .update({
        name: draft.name.trim(),
        status: draft.status,
        status_note: draft.note.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", auth.user.id);
    if (error) return serverError("onboarding profile", error);
  }
  // The caller was verified above and can update only their own parsed draft.
  // Auth's public /user endpoint shares a small sign-in rate bucket by IP;
  // autosaving answers there can throttle unrelated users behind this server.
  const { error } = await createAdminClient().auth.admin.updateUserById(auth.user.id, {
    user_metadata: {
      onboarding: draft,
      onboarding_setup: setup ?? null,
      ...(draft.finished ? { full_name: draft.name.trim() } : {}),
    },
  });
  if (error) return serverError("onboarding answers", error);
  return NextResponse.json({ saved: true });
}
