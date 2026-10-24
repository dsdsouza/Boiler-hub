import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encrypt } from "@/lib/crypto";
import { NEXT_COOKIE, safeNext } from "@/lib/auth";

// Google access tokens last 1 hour; Supabase does not expose Google's expires_in.
const GOOGLE_ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(request.cookies.get(NEXT_COOKIE)?.value);

  if (!code) {
    return NextResponse.redirect(`${origin}/?error=auth`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session) {
    return NextResponse.redirect(`${origin}/?error=auth`);
  }

  const { user, provider_token, provider_refresh_token } = data.session;
  if (provider_token) {
    const row: Record<string, string> = {
      user_id: user.id,
      access_token: provider_token,
      expires_at: new Date(Date.now() + GOOGLE_ACCESS_TOKEN_TTL_MS).toISOString(),
      updated_at: new Date().toISOString(),
    };
    // Only overwrite the refresh token when Google issued a new one.
    if (provider_refresh_token) row.refresh_token = encrypt(provider_refresh_token);

    const { error: tokenError } = await createAdminClient()
      .from("google_tokens")
      .upsert(row, { onConflict: "user_id" });
    if (tokenError) console.error("google_tokens upsert failed", tokenError.message);
  }

  const response = NextResponse.redirect(`${origin}${next}`);
  response.cookies.delete({ name: NEXT_COOKIE, path: "/auth" });
  return response;
}
