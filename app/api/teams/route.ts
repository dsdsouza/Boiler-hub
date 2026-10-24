import { NextResponse } from "next/server";
import { listMyTeams } from "@/lib/data/teams";
import { fail, getCaller, readJson, serverError } from "./_lib/http";

// GET /api/teams: my teams with my role and visibility.
export async function GET() {
  const caller = await getCaller();
  if (!caller) return fail(401, "Sign in first");
  try {
    return NextResponse.json({ teams: await listMyTeams(caller.supabase, caller.user.id) });
  } catch (e) {
    return serverError(e);
  }
}

// POST /api/teams { name, type }: creator becomes lead; create_team() generates a unique invite code.
export async function POST(req: Request) {
  const caller = await getCaller();
  if (!caller) return fail(401, "Sign in first");

  const body = (await readJson(req)) as { name?: unknown; type?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (name.length < 1 || name.length > 80) return fail(400, "Name must be 1 to 80 characters");
  if (body?.type !== "class" && body?.type !== "work") return fail(400, "Type must be class or work");

  const { data, error } = await caller.supabase.rpc("create_team", { name, type: body.type });
  if (error) return serverError(error);
  const team = data as { id: string; name: string; type: "class" | "work"; invite_code: string };
  return NextResponse.json(
    { team: { id: team.id, name: team.name, type: team.type, inviteCode: team.invite_code } },
    { status: 201 },
  );
}
