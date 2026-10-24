// Routes that require a signed-in user. Used by middleware.
export const PROTECTED_PREFIXES = ["/boiler", "/teams", "/onboarding"];

// Cookie carrying the post-login path from /auth/signin to /auth/callback.
export const NEXT_COOKIE = "bp_next";

// Only allow same-origin relative paths as post-login redirects.
export function safeNext(next: string | null | undefined, fallback = "/onboarding"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}
