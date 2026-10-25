// Routes that require a signed-in user. The first onboarding questions are public.
export const PROTECTED_PREFIXES = ["/boiler", "/calendar", "/teams", "/settings"];
export const NEXT_COOKIE = "bp_next";

/** Accept only local paths, including when a browser normalizes backslashes. */
export function safeNext(next: string | null | undefined, fallback = "/onboarding"): string {
  if (!next || !next.startsWith("/") || /[\\\u0000-\u001f\u007f]/.test(next)) return fallback;
  try {
    const base = "https://boilerplate.invalid";
    return new URL(next, base).origin === base ? next : fallback;
  } catch { return fallback; }
}

/** Next can normalize loopback URLs; the request Host keeps its browser origin. */
export function authOrigin(request: { url: string; headers: Headers }): string {
  const fallback = new URL(request.url);
  const host = request.headers.get("host");
  if (host && /^(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/.test(host)) return `http://${host}`;
  if (host && /^(?:boilerhub\.work|www\.boilerhub\.work|(?:[a-z0-9-]+\.)?boilerplate\.zhomander\.workers\.dev)$/.test(host)) return `https://${host}`;
  return fallback.origin;
}

export function authFailurePath(next: string, reason: "signin" | "auth"): string {
  return `${new URL(next, "https://boilerplate.invalid").pathname === "/onboarding" ? "/onboarding" : "/"}?error=${reason}`;
}
