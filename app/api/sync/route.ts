import { NextResponse } from "next/server";
import { requireUser, serverError, syncSelf } from "@/app/api/me/_lib/http";

// Fetch Google, compute, upsert the snapshot (Refresh button, after login).
export async function POST() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json(await syncSelf(auth.user));
  } catch (e) {
    return serverError("POST /api/sync", e);
  }
}
