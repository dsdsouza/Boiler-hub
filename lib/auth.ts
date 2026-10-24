// Routes that require a signed-in user. Used by middleware.
export const PROTECTED_PREFIXES = ["/boiler", "/teams", "/onboarding"];

// Only allow same-origin relative paths as post-login redirects.
export function safeNext(next: string | null | undefined, fallback = "/onboarding"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}
