import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authFailurePath, authOrigin, NEXT_COOKIE, safeNext } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const origin = authOrigin(request);
  const next = safeNext(searchParams.get("next"));
  // A preview without auth configuration should return to the saved journey.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.redirect(`${origin}${authFailurePath(next, "signin")}`);
  }
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      // Keep this exactly /auth/callback (no query string) so it matches the
      // Supabase redirect allowlist. The post-login path travels in a cookie.
      redirectTo: `${origin}/auth/callback`,
      scopes: "openid email profile https://www.googleapis.com/auth/calendar.readonly",
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });

  if (error || !data.url) {
    return NextResponse.redirect(`${origin}${authFailurePath(next, "signin")}`);
  }
  const response = NextResponse.redirect(data.url);
  response.cookies.set(NEXT_COOKIE, next, {
    path: "/auth",
    httpOnly: true,
    sameSite: "lax",
    secure: origin.startsWith("https://"),
    maxAge: 600,
  });
  return response;
}
