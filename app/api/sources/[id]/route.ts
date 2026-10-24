import { NextResponse } from "next/server";
import { forgetSource } from "@/lib/sources/load";
import { UUID_RE, requireUser, serverError, syncSelf } from "@/app/api/me/_lib/http";
import { notFound } from "../_lib";

// DELETE: removes the caller's source (its item state cascades), then resyncs. Returns { boiler }.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (!UUID_RE.test(id)) return notFound();

  // RLS: only the owner's row matches.
  const { data, error } = await auth.supabase.from("sources").delete().eq("id", id).select("id");
  if (error) return serverError("DELETE /api/sources", error);
  if (!data || data.length === 0) return notFound();
  forgetSource(id);

  try {
    return NextResponse.json({ boiler: await syncSelf(auth.user) });
  } catch (e) {
    return serverError("DELETE /api/sources resync", e);
  }
}
