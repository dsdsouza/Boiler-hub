import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decrypt } from "@/lib/crypto";

// Google access tokens for a user, refreshed through Google's token endpoint.
// Supabase does not refresh provider tokens, so we do it here.

const TOKEN_URL = "https://oauth2.googleapis.com/token";
/** Refresh when the access token expires within this window. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

/** The user must sign in with Google again (no token row, no refresh token, or refresh rejected). */
export class GoogleReconnectError extends Error {
  constructor(reason: string) {
    super(`Google reconnect needed: ${reason}`);
    this.name = "GoogleReconnectError";
  }
}

interface TokenRow {
  refresh_token: string | null;
  access_token: string | null;
  expires_at: string | null;
}

/**
 * Valid access token for `userId`. `admin` must be the service-role client (google_tokens is
 * service-role only); callers must already have authenticated the user they pass in.
 */
export async function getAccessToken(admin: SupabaseClient, userId: string, now = new Date()): Promise<string> {
  const { data, error } = await admin
    .from("google_tokens")
    .select("refresh_token, access_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle<TokenRow>();
  if (error) throw new Error(`google_tokens read failed: ${error.message}`);
  if (!data) throw new GoogleReconnectError("no token row");

  const expiresAt = data.expires_at ? Date.parse(data.expires_at) : 0;
  if (data.access_token && expiresAt - now.getTime() > REFRESH_MARGIN_MS) return data.access_token;

  if (!data.refresh_token) throw new GoogleReconnectError("no refresh token");
  const { accessToken, expiresIn } = await refresh(decrypt(data.refresh_token));

  const { error: saveError } = await admin
    .from("google_tokens")
    .update({
      access_token: accessToken,
      expires_at: new Date(now.getTime() + expiresIn * 1000).toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("user_id", userId);
  if (saveError) console.error("google_tokens update failed", saveError.message);

  return accessToken;
}

async function refresh(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  // invalid_grant: revoked, or expired (Testing-mode refresh tokens last 7 days).
  if (body.error === "invalid_grant") throw new GoogleReconnectError(body.error_description ?? "invalid_grant");
  if (!res.ok || !body.access_token) {
    throw new Error(`Google token refresh failed (${res.status}): ${body.error ?? "no access_token"}`);
  }
  return { accessToken: body.access_token, expiresIn: body.expires_in ?? 3600 };
}
