import { NextResponse } from "next/server";
import { STATUSES, badRequest, oneOf, readJson, requireUser, serverError } from "../_lib/http";

const NOTE_MAX = 80;

// Body: { status, note? }. `note` omitted leaves it unchanged; null or "" clears it. Never changes the score.
export async function PATCH(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = await readJson(request);
  if (!body) return badRequest("Expected a JSON object");
  if (!oneOf(STATUSES, body.status)) return badRequest(`status must be one of ${STATUSES.join(", ")}`);

  const patch: { status: string; status_note?: string | null; updated_at: string } = {
    status: body.status,
    updated_at: new Date().toISOString(),
  };
  if ("note" in body) {
    if (body.note !== null && typeof body.note !== "string") return badRequest("note must be a string or null");
    const note = typeof body.note === "string" ? body.note.trim() : "";
    if (note.length > NOTE_MAX) return badRequest(`note must be at most ${NOTE_MAX} characters`);
    patch.status_note = note || null;
  }

  const { data, error } = await auth.supabase
    .from("profiles")
    .update(patch)
    .eq("id", auth.user.id)
    .select("status, status_note")
    .single();
  if (error) return serverError("PATCH /api/me/status", error);
  return NextResponse.json({ status: data.status, note: data.status_note });
}
