import { NextResponse } from "next/server";
import { TASK_COLUMNS as COLUMNS, toTask } from "@/lib/google/sync";
import { SIZES, UUID_RE, badRequest, oneOf, readJson, requireUser, serverError, syncSelf } from "@/app/api/me/_lib/http";
import { parseCourse, parseDue, parseTitle } from "../validate";

// DELETE: removes one of the caller's manual tasks (e.g. a stale one). Team assignments and
// source items cannot be removed, only marked done. Resyncs, returns { boiler }.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  // RLS: only the owner's own task matches.
  const { data, error } = await auth.supabase.from("tasks").delete().eq("id", id).eq("source", "manual").select("id");
  if (error) return serverError("DELETE /api/tasks", error);
  if (!data || data.length === 0) return NextResponse.json({ error: "Only your own manual tasks can be removed" }, { status: 404 });

  try {
    return NextResponse.json({ boiler: await syncSelf(auth.user) });
  } catch (e) {
    return serverError("DELETE /api/tasks resync", e);
  }
}

// Body: { title?, due_at?, size?, course?, done? }. course null or "" clears it. done: true sets done_at = now, false clears it.
// Team-assigned tasks can only be completed or reopened. Resyncs, returns { task, boiler }.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  const body = await readJson(request);
  if (!body) return badRequest("Expected a JSON object");

  // RLS: only the owner's own task is visible.
  const { data: existing, error: readError } = await auth.supabase.from("tasks").select(COLUMNS).eq("id", id).maybeSingle();
  if (readError) return serverError("PATCH /api/tasks read", readError);
  if (!existing) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const patch: Record<string, string | null> = {};
  if (body.title !== undefined) {
    const title = parseTitle(body.title);
    if (title === null) return badRequest("title must be 1 to 200 characters");
    patch.title = title;
  }
  if (body.due_at !== undefined) {
    const due = parseDue(body.due_at);
    if (due === false) return badRequest("due_at must be an ISO date-time or null");
    patch.due_at = due ?? null;
  }
  if (body.size !== undefined) {
    if (!oneOf(SIZES, body.size)) return badRequest("size must be S, M or L");
    patch.size = body.size;
  }
  if (body.course !== undefined) {
    const course = parseCourse(body.course);
    if (course === false) return badRequest("course must be up to 60 characters, or null");
    patch.course = course ?? null;
  }
  if (existing.source === "team" && Object.keys(patch).length > 0) {
    return NextResponse.json({ error: "Team assignments can only be completed or reopened" }, { status: 403 });
  }
  if (body.done !== undefined) {
    if (typeof body.done !== "boolean") return badRequest("done must be true or false");
    // Keep the original completion time if it is already done.
    patch.done_at = body.done ? (existing.done_at ?? new Date().toISOString()) : null;
  }
  if (Object.keys(patch).length === 0) return badRequest("Nothing to update");

  const { data, error } = await auth.supabase.from("tasks").update(patch).eq("id", id).select(COLUMNS).single();
  if (error) return serverError("PATCH /api/tasks", error);

  try {
    return NextResponse.json({ task: toTask(data), boiler: await syncSelf(auth.user) });
  } catch (e) {
    return serverError("PATCH /api/tasks resync", e);
  }
}
