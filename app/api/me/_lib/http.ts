import "server-only";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncUser, type SyncOptions } from "@/lib/google/sync";

// Shared helpers for the engine's route handlers (app/api/me, sync, tasks, event-weights).

export type UserClient = Awaited<ReturnType<typeof createClient>>;

/** The signed-in user and their RLS-bound client, or a 401 response. */
export async function requireUser(): Promise<{ user: User; supabase: UserClient } | NextResponse> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  return { user: data.user, supabase };
}

/** Recompute for the signed-in user. Only ever pass the id from requireUser() (CLAUDE.md rule 6). */
export function syncSelf(user: User, opts?: SyncOptions) {
  return syncUser(createAdminClient(), user.id, new Date(), opts);
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function serverError(where: string, e: unknown) {
  console.error(`${where} failed`, e);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}

/** Parsed JSON object body, or null if the body is not a JSON object. */
export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export const SIZES = ["S", "M", "L"] as const;
export const WEIGHT_TAGS = ["light", "normal", "heavy"] as const;
export const STATUSES = ["open", "heads_down", "running_hot", "away"] as const;

export function oneOf<T extends string>(values: readonly T[], v: unknown): v is T {
  return typeof v === "string" && (values as readonly string[]).includes(v);
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
