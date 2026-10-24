import { NextResponse } from "next/server";
import { eventKey } from "@/lib/google/normalize";
import { WEIGHT_TAGS, badRequest, oneOf, readJson, requireUser, serverError, syncSelf } from "@/app/api/me/_lib/http";

const SERIES_KEY_RE = /^[0-9a-f]{64}$/;

// Body: { eventId, weight: 'light' | 'normal' | 'heavy' | null, applyToSeries?, seriesKey? }.
// applyToSeries tags the whole series (seriesKey from the event list); otherwise just this event.
// weight null removes the override. Resyncs, returns the BoilerResponse.
export async function PUT(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = await readJson(request);
  if (!body) return badRequest("Expected a JSON object");
  if (body.weight !== null && !oneOf(WEIGHT_TAGS, body.weight)) return badRequest("weight must be light, normal, heavy or null");

  let key: string;
  if (body.applyToSeries === true) {
    if (typeof body.seriesKey !== "string" || !SERIES_KEY_RE.test(body.seriesKey)) {
      return badRequest("seriesKey is required to apply to a series");
    }
    key = body.seriesKey;
  } else {
    if (typeof body.eventId !== "string" || body.eventId.length === 0 || body.eventId.length > 1024) {
      return badRequest("eventId is required");
    }
    key = eventKey(body.eventId);
  }

  // RLS: event_weights is owner-only.
  const table = auth.supabase.from("event_weights");
  const { error } =
    body.weight === null
      ? await table.delete().eq("user_id", auth.user.id).eq("series_key", key)
      : await table.upsert(
          { user_id: auth.user.id, series_key: key, weight: body.weight, updated_at: new Date().toISOString() },
          { onConflict: "user_id,series_key" },
        );
  if (error) return serverError("PUT /api/event-weights", error);

  try {
    return NextResponse.json(await syncSelf(auth.user));
  } catch (e) {
    return serverError("PUT /api/event-weights resync", e);
  }
}
