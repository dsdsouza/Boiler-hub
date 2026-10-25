import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { testSource } from "@/lib/sources/load";
import { UUID_RE, requireUser, serverError } from "@/app/api/me/_lib/http";
import { itemCounts, notFound } from "../../_lib";

// POST: refetch one source and report { ok, error, itemCount, tasks, events, source }.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (!UUID_RE.test(id)) return notFound();

  // Ownership check with the user client (RLS) before the admin client reads the secret (rule 6).
  const { data: owned, error } = await auth.supabase.from("sources").select("id,kind").eq("id", id).maybeSingle();
  if (error) return serverError("POST /api/sources/test read", error);
  if (!owned) return notFound();
  if (owned.kind !== "ics") return NextResponse.json({ error: "This integration is no longer available." }, { status: 410 });

  try {
    const tested = await testSource(createAdminClient(), auth.user.id, id, new Date());
    if (!tested) return notFound();
    return NextResponse.json({
      ok: tested.summary.status === "ok",
      error: tested.summary.error,
      ...itemCounts(tested.items),
      source: tested.summary,
    });
  } catch (e) {
    return serverError("POST /api/sources/test", e);
  }
}
