import { NextResponse } from "next/server";
import { silentDoneAt } from "@/lib/sources/state";
import type { ItemStateRow } from "@/lib/sources/types";
import { SIZES, UUID_RE, badRequest, oneOf, readJson, requireUser, serverError, syncSelf } from "@/app/api/me/_lib/http";
import { ITEM_KEY_RE, notFound } from "../_lib";

const MAX_BULK = 200;

interface Ref {
  sourceId: string;
  itemKey: string;
}

function isRef(v: unknown): v is Ref {
  const r = v as Ref;
  return !!r && typeof r === "object" && typeof r.sourceId === "string" && UUID_RE.test(r.sourceId) && typeof r.itemKey === "string" && ITEM_KEY_RE.test(r.itemKey);
}

// PATCH, one of:
//   { sourceId, itemKey, done?: boolean, size?: 'S' | 'M' | 'L' | null }   mark done/undone, set or clear the size
//   { items: [{ sourceId, itemKey }], clear: true }                         "Mark all overdue done": done, no vent
// Writes source_item_state with the user client (RLS: own rows on own sources), resyncs, returns { boiler }.
export async function PATCH(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = await readJson(request);
  if (!body) return badRequest("Expected a JSON object");
  const now = new Date();
  const updated_at = now.toISOString();

  let rows: Record<string, unknown>[];
  if (body.clear === true) {
    if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > MAX_BULK || !body.items.every(isRef)) {
      return badRequest(`items must be 1 to ${MAX_BULK} { sourceId, itemKey } pairs`);
    }
    const done_at = silentDoneAt(now);
    rows = (body.items as Ref[]).map((r) => ({ user_id: auth.user.id, source_id: r.sourceId, item_key: r.itemKey, done_at, updated_at }));
  } else {
    if (!isRef(body)) return badRequest("sourceId and itemKey are required");
    const row: Record<string, unknown> = { user_id: auth.user.id, source_id: body.sourceId, item_key: body.itemKey, updated_at };
    if (body.size !== undefined) {
      if (body.size !== null && !oneOf(SIZES, body.size)) return badRequest("size must be S, M, L or null");
      row.size_override = body.size;
    }
    if (body.done !== undefined) {
      if (typeof body.done !== "boolean") return badRequest("done must be true or false");
      let doneAt: string | null = null;
      if (body.done) {
        // Keep the original completion time if it is already done.
        const { data: existing, error } = await auth.supabase
          .from("source_item_state")
          .select("done_at")
          .eq("source_id", body.sourceId)
          .eq("item_key", body.itemKey)
          .maybeSingle<Pick<ItemStateRow, "done_at">>();
        if (error) return serverError("PATCH /api/sources/items read", error);
        doneAt = existing?.done_at ?? updated_at;
      }
      row.done_at = doneAt;
    }
    if (body.size === undefined && body.done === undefined) return badRequest("Nothing to update");
    rows = [row];
  }

  // Every referenced source must be the caller's (RLS hides others, so a missing one is a 404).
  const sourceIds = [...new Set(rows.map((r) => r.source_id as string))];
  const { data: owned, error: ownError } = await auth.supabase.from("sources").select("id").in("id", sourceIds);
  if (ownError) return serverError("PATCH /api/sources/items sources", ownError);
  if ((owned ?? []).length !== sourceIds.length) return notFound();

  const { error } = await auth.supabase.from("source_item_state").upsert(rows, { onConflict: "user_id,source_id,item_key" });
  if (error) return serverError("PATCH /api/sources/items", error);

  try {
    return NextResponse.json({ boiler: await syncSelf(auth.user) });
  } catch (e) {
    return serverError("PATCH /api/sources/items resync", e);
  }
}
