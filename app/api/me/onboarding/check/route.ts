import { NextResponse } from "next/server";
import { requireUser, serverError, syncSelf } from "../../_lib/http";
import { issueReview } from "../verification";

export async function POST() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const boiler = await syncSelf(auth.user, { freshSources: true, persist: "ifStale" });
    return NextResponse.json({ boiler, reviewReceipt: issueReview(auth.user.id, boiler) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return serverError("onboarding coursework check", error); }
}
