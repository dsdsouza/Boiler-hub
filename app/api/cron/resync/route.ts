import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncUser } from "@/lib/google/sync";

// GET /api/cron/resync: daily background resync from the Cloudflare scheduled handler,
// authorized by its `Authorization: Bearer $CRON_SECRET` header.
//
// This is a system job, not a user request: the secret is the authorization, and every query
// syncUser makes is scoped to the one user being synced (CLAUDE.md rule 6 applies per user).

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH = 5;
/** Stop starting new batches after this, so the function finishes inside maxDuration. */
const BUDGET_MS = 50_000;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const started = Date.now();
  const admin = createAdminClient();
  const { data, error } = await admin.from("google_tokens").select("user_id").returns<{ user_id: string }[]>();
  if (error) {
    console.error("[cron/resync] google_tokens read failed", error.message);
    return NextResponse.json({ error: "Could not list users" }, { status: 500 });
  }
  const users = (data ?? []).map((r) => r.user_id);

  let ok = 0;
  let failed = 0;
  let done = 0;
  for (let i = 0; i < users.length; i += BATCH) {
    if (Date.now() - started > BUDGET_MS) break;
    const batch = users.slice(i, i + BATCH);
    const results = await Promise.allSettled(batch.map((id) => syncUser(admin, id, new Date())));
    results.forEach((r, j) => {
      if (r.status === "fulfilled") ok++;
      else {
        failed++;
        console.error(`[cron/resync] ${batch[j]} failed`, r.reason);
      }
    });
    done += batch.length;
  }

  const summary = { users: users.length, ok, failed, deferred: users.length - done, ms: Date.now() - started };
  console.log("[cron/resync]", JSON.stringify(summary));
  return NextResponse.json(summary);
}
