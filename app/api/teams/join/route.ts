import { NextResponse } from "next/server";
import { fail, getCaller, readJson, serverError } from "../_lib/http";

// POST /api/teams/join { code }: joins as a hidden member (join_team() is idempotent).
export async function POST(req: Request) {
  const caller = await getCaller();
  if (!caller) return fail(401, "Sign in first");

  const body = (await readJson(req)) as { code?: unknown } | null;
  const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
  if (!/^[A-Z0-9]{6}$/.test(code)) return fail(400, "Invite codes are 6 letters or numbers");

  const { data, error } = await caller.supabase.rpc("join_team", { code });
  if (error) {
    if (error.code === "P0002") return fail(404, "No team with that code");
    return serverError(error);
  }
  return NextResponse.json({ teamId: data as string });
}
