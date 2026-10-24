import { NextResponse } from "next/server";
import { requireUser, serverError, syncSelf } from "../_lib/http";

// Live compute from Google + tasks. Saves the snapshot only if it is missing or older than 30 minutes.
export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json(await syncSelf(auth.user, { persist: "ifStale" }));
  } catch (e) {
    return serverError("GET /api/me/boiler", e);
  }
}
