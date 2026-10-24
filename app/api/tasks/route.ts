import { NextResponse } from "next/server";
import { toTask } from "@/lib/google/sync";
import { SIZES, badRequest, oneOf, readJson, requireUser, serverError, syncSelf } from "@/app/api/me/_lib/http";
import { parseDue, parseTitle } from "./validate";

// Body: { title, due_at?, size? }. Creates a manual task, then resyncs.
// Returns { task, boiler }.
export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = await readJson(request);
  if (!body) return badRequest("Expected a JSON object");
  const title = parseTitle(body.title);
  if (title === null) return badRequest("title must be 1 to 200 characters");
  const due = parseDue(body.due_at);
  if (due === false) return badRequest("due_at must be an ISO date-time or null");
  if (body.size !== undefined && !oneOf(SIZES, body.size)) return badRequest("size must be S, M or L");

  const { data, error } = await auth.supabase
    .from("tasks")
    .insert({ owner_id: auth.user.id, title, due_at: due ?? null, size: body.size ?? "M", source: "manual" })
    .select("id, title, due_at, size, done_at, source, assignment_id")
    .single();
  if (error) return serverError("POST /api/tasks", error);

  try {
    return NextResponse.json({ task: toTask(data), boiler: await syncSelf(auth.user) }, { status: 201 });
  } catch (e) {
    return serverError("POST /api/tasks resync", e);
  }
}
