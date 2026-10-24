import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { encrypt, decrypt } from "@/lib/crypto";
import { CALENDAR_TOKEN_RE } from "@/lib/calendar/links";
import { requireUser } from "@/app/api/me/_lib/http";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
const respond = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });
const failed = () => respond({ error: "Calendar subscriptions are unavailable right now. Try again later." }, 503);

interface SubscriptionRow { token_hash: string; token_encrypted: string }
type Auth = Exclude<Awaited<ReturnType<typeof requireUser>>, NextResponse>;
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

function present(row: SubscriptionRow) {
  const token = decrypt(row.token_encrypted);
  if (!CALENDAR_TOKEN_RE.test(token) || hash(token) !== row.token_hash) throw new Error("Invalid subscription credentials");
  return { feedPath: `/api/calendar/feed/${token}.ics` };
}

function read(auth: Auth) {
  return auth.supabase.from("calendar_subscriptions").select("token_hash, token_encrypted")
    .eq("user_id", auth.user.id).maybeSingle<SubscriptionRow>();
}

export async function GET() {
  try {
    const auth = await requireUser();
    if (auth instanceof NextResponse) return auth;
    const { data, error } = await read(auth);
    if (error) return failed();
    return respond(data ? present(data) : { feedPath: null });
  } catch { return failed(); }
}

/** Reuse an active link; repeated or concurrent clicks never invalidate an existing subscription. */
export async function POST() {
  try {
    const auth = await requireUser();
    if (auth instanceof NextResponse) return auth;
    const { data, error } = await read(auth);
    if (error) return failed();
    if (data) return respond(present(data));
    const token = randomBytes(32).toString("hex");
    const row = { token_hash: hash(token), token_encrypted: encrypt(token) };
    const { error: insertError } = await auth.supabase.from("calendar_subscriptions").insert({ user_id: auth.user.id, ...row });
    if (insertError?.code === "23505") {
      const current = await read(auth);
      return current.data && !current.error ? respond(present(current.data)) : failed();
    }
    if (insertError) return failed();
    return respond(present(row), 201);
  } catch { return failed(); }
}

export async function DELETE() {
  try {
    const auth = await requireUser();
    if (auth instanceof NextResponse) return auth;
    const { error } = await auth.supabase.from("calendar_subscriptions").delete().eq("user_id", auth.user.id);
    return error ? failed() : respond({ feedPath: null });
  } catch { return failed(); }
}
