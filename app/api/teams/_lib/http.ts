import "server-only";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/data/teams";
import type { Role } from "@/lib/types";

type UserClient = Awaited<ReturnType<typeof createClient>>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function fail(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export function serverError(e: unknown) {
  console.error("[api/teams]", e);
  return fail(500, "Something went wrong");
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

// Signed-in caller with the RLS-bound user client, or null.
export async function getCaller(): Promise<{ supabase: UserClient; user: User } | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ? { supabase, user: data.user } : null;
}

// Verifies the caller's membership (and optionally lead role) in a team via the user client.
// Returns an error response, or the caller's role. Non-members get 404 so team ids don't leak.
export async function requireTeamRole(
  supabase: UserClient,
  teamId: string,
  userId: string,
  need: "member" | "lead",
): Promise<{ role: Role } | { error: NextResponse }> {
  if (!UUID_RE.test(teamId)) return { error: fail(404, "Team not found") };
  const me = await getMembership(supabase, teamId, userId);
  if (!me) return { error: fail(404, "Team not found") };
  if (need === "lead" && me.role !== "lead") return { error: fail(403, "Leads only") };
  return { role: me.role };
}

export function isUuid(s: unknown): s is string {
  return typeof s === "string" && UUID_RE.test(s);
}
